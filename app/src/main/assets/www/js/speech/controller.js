/* SpeechEngine contract:
 * initialize(): Promise<void>
 * start({language,onStarted,onPartial}): {result: Promise<string>,stop(),cancel()}
 * release(): void (invalidate pending initialization and release owned resources)
 * A session's result settles exactly once, including cancellation.
 */
(function (global) {
  "use strict";
  function error(code, message) {
    var e = new Error(message);
    e.code = code;
    return e;
  }
  function asError(value) {
    return value && typeof value.message === "string"
      ? value
      : error(
          "SPEECH_FAILED",
          value ? String(value) : "تعذّر تشغيل محرك الصوت",
        );
  }
  function aborted() {
    var e = error("CANCELLED", "أُلغي التسجيل");
    e.name = "AbortError";
    return e;
  }
  function Controller(factory, notify, limits) {
    this.factory = factory;
    this.notify = notify || function () {};
    this.limits = limits || { initializeMs: 90000, recordMs: 30000 };
    this.job = null;
    this.engine = null;
    this.type = null;
    this.state = Object.freeze({ status: "idle", engine: null, error: null });
  }
  Controller.prototype.update = function (status, failure) {
    this.state = Object.freeze({
      status: status,
      engine: this.type,
      error: failure
        ? { code: failure.code || "SPEECH_FAILED", message: failure.message }
        : null,
    });
    this.notify(this.state);
  };
  Controller.prototype.start = function (type, options) {
    var self = this;
    options = options || {};
    if (this.job)
      return Promise.reject(error("BUSY", "يوجد تسجيل أو تعرّف جارٍ"));
    try {
      if (this.type !== type || !this.engine) {
        var previous = this.engine;
        this.engine = null;
        this.type = type;
        if (previous) previous.release();
        this.engine = this.factory.create(type);
      }
    } catch (failure) {
      failure = asError(failure);
      this.update("error", failure);
      return Promise.reject(failure);
    }
    var engine = this.engine;
    var job = { handle: null, timer: null };
    var result = new Promise(function (resolve, reject) {
      job.resolve = resolve;
      job.reject = reject;
    });
    this.job = job;
    this.update("initializing");
    job.timer = setTimeout(function () {
      if (self.job !== job) return;
      self.finish(
        job,
        error("INITIALIZE_TIMEOUT", "انتهت مهلة تجهيز المحرك أو الميكروفون"),
      );
      engine.release();
    }, this.limits.initializeMs);
    Promise.resolve()
      .then(function () {
        if (self.job !== job) return;
        return engine.initialize();
      })
      .then(function () {
        if (self.job !== job) return;
        self.update("starting");
        job.handle = engine.start({
          language: options.language || "ar",
          onStarted: function () {
            if (self.job !== job || self.state.status === "stopping") return;
            clearTimeout(job.timer);
            self.update("listening");
            if (self.job !== job) return;
            job.timer = setTimeout(function () {
              if (self.job === job) self.stop();
            }, self.limits.recordMs);
          },
          onPartial: function (text) {
            if (self.job === job && options.onPartial)
              options.onPartial(String(text));
          },
        });
        return job.handle.result.then(function (text) {
          if (self.job !== job) return;
          text = String(text || "").trim();
          if (!text) throw error("NO_SPEECH", "لم يُلتقط كلام واضح");
          self.finish(job, null, text);
        });
      })
      .catch(function (failure) {
        failure = asError(failure);
        if (self.job !== job) return;
        if (job.handle) job.handle.cancel();
        self.finish(job, failure);
      });
    return result;
  };
  Controller.prototype.finish = function (job, failure, text) {
    if (this.job !== job) return;
    clearTimeout(job.timer);
    this.job = null;
    this.update(
      failure ? (failure.name === "AbortError" ? "idle" : "error") : "ready",
      failure,
    );
    if (failure) job.reject(failure);
    else job.resolve(text);
  };
  Controller.prototype.stop = function () {
    var self = this,
      job = this.job;
    if (!job || this.state.status === "stopping") return;
    if (!job.handle) {
      this.cancel();
      return;
    }
    clearTimeout(job.timer);
    this.update("stopping");
    try {
      Promise.resolve(job.handle.stop()).catch(function (failure) {
        failure = asError(failure);
        if (self.job !== job) return;
        job.handle.cancel();
        self.finish(job, failure);
      });
    } catch (failure) {
      job.handle.cancel();
      this.finish(job, asError(failure));
    }
  };
  Controller.prototype.cancel = function () {
    var job = this.job;
    if (!job) return;
    // Invalidate the job before touching an engine: synchronous callbacks are stale too.
    this.finish(job, aborted());
    if (job.handle) job.handle.cancel();
    else if (this.engine) this.engine.release();
  };
  Controller.prototype.release = function () {
    this.cancel();
    if (this.engine) this.engine.release();
    this.engine = null;
    this.type = null;
    this.update("released");
  };
  Controller.prototype.invalidate = function (type) {
    if (this.type === type) this.release();
  };
  global.DaftariSpeech = {
    Controller: Controller,
    error: error,
    aborted: aborted,
    EngineState: Object.freeze({
      IDLE: "idle",
      INITIALIZING: "initializing",
      STARTING: "starting",
      LISTENING: "listening",
      STOPPING: "stopping",
      READY: "ready",
      ERROR: "error",
      RELEASED: "released",
    }),
  };
})(window);
