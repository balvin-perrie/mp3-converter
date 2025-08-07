/* global FFmpegWASM, manager */

const OPTIONS = {
  coreURL: 'mp3/external/ffmpeg-core.js',
  wasmURL: 'mp3/external/ffmpeg-core.wasm'
};

self.Worker = new Proxy(Worker, {
  construct(Target, args) {
    args[0] = 'worker.js';

    return new Target(...args);
  }
});

const tt = msg => {
  if (msg) {
    document.title = msg;
  }
  else if (tt.version) {
    document.title = 'Media Converter (based on ffmpeg ' + tt.version + ')';
  }
  else {
    document.title = 'Media Converter';
  }
};

manager.ready();

{
  const ffmpeg = new FFmpegWASM.FFmpeg();
  const observe = e => {
    if (e.message.includes('ffmpeg version')) {
      tt.version = e.message.split('ffmpeg version ')[1].split(' ')[0];
      tt();
    }
  };
  ffmpeg.on('log', observe);
  ffmpeg.load(OPTIONS).then(() => ffmpeg.exec(['-version']).then(() => ffmpeg.terminate()));
}

const mp3 = {};
mp3.fetch = async (url, signal, obj) => {
  const response = await fetch(url, {signal});

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const contentLength = response.headers.get('Content-Length');
  if (!contentLength) {
    return response.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const total = parseInt(contentLength, 10);
    let loaded = 0;
    const reader = response.body.getReader();

    const abs = [];
    const push = () => {
      reader.read().then(({done, value}) => {
        if (done) {
          resolve(abs);
          return;
        }

        loaded += value.byteLength;
        obj.progress(loaded / total * 100);
        abs.push(value);
        push();
      }).catch(e => reject(e));
    };
    push();
  });
};
{
  let busy = false;
  const jobs = [];
  mp3.convert = async (...args) => {
    if (busy) {
      jobs.push(args);
      return;
    }
    busy = true;

    const ffmpeg = new FFmpegWASM.FFmpeg();


    const [{file, signal}, bitrate = 'v1', obj] = args;
    tt('Working on ' + file.name + '. ' + jobs.length + ' jobs left.');
    obj.focus();

    await ffmpeg.load(OPTIONS);

    const terminate = () => ffmpeg.terminate();
    signal.addEventListener('abort', terminate);

    const progress = e => {
      obj.progress(e.progress * 100);
    };
    let error = '';
    const observe = e => {
      if (e.type === 'stderr') {
        if (e.message.includes('Output file #0 does not contain any stream')) {
          error = 'Input does not contain any stream';
        }
      }
    };

    // in case a job is removed before processing
    if (signal.aborted === false) {
      try {
        obj.message('transferring...');

        await ffmpeg.createDir('/work');
        await ffmpeg.mount('WORKERFS', {
          files: [file]
        }, '/work');

        obj.progress(0);
        obj.message('encoding...');

        ffmpeg.on('progress', progress);
        ffmpeg.on('log', observe);

        const bt = [];
        if (bitrate.startsWith('v')) {
          bt.push('-q:a', bitrate.replace('v', ''));
        }
        else {
          bt.push('-b:a', bitrate + 'k');
        }

        await ffmpeg.exec(['-i', '/work/' + file.name, ...bt, '/output.mp3']);

        const data = await ffmpeg.readFile('/output.mp3');
        await ffmpeg.terminate();

        obj.done(data);

        obj.message('done!');
      }
      catch (e) {
        console.error(e);
        obj.error(error || e.message);
      }
    }

    signal.removeEventListener('abort', terminate);

    busy = false;

    const next = jobs.shift();
    if (next) {
      mp3.convert(...next);
    }
    else {
      tt();
    }
  };
}

window.mp3 = mp3;
