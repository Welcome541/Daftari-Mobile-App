/* Transport only. This is the only module that accesses window.Daftari. */
(function () {
  "use strict";
  var native = window.Daftari;
  if (!native) return;
  var modern = typeof native.dispatch === "function";
  var pending = new Map(),
    sequence = 0,
    closed = false;
  var prefix =
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  var methods = {
    "models.list": 10000,
    "model.import": 900000,
    "project.import": 900000,
    "contact.pick": 180000,
  };
  function failure(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }
  function emit(type, message) {
    window.dispatchEvent(
      new CustomEvent("daftari-native-event", {
        detail: { type: type, message: String(message || "") },
      }),
    );
  }
  function sendCancel(id) {
    try {
      native.dispatch(JSON.stringify({ version: 2, type: "cancel", id: id }));
    } catch (_) {}
  }
  function finish(id, error, value) {
    var job = pending.get(id);
    if (!job) return;
    pending.delete(id);
    clearTimeout(job.timer);
    if (job.signal && job.abort)
      job.signal.removeEventListener("abort", job.abort);
    if (error) job.reject(error);
    else job.resolve(value);
  }
  function cancel(id, code) {
    if (!pending.has(id)) return;
    finish(
      id,
      failure(
        code || "CANCELLED",
        code === "TIMEOUT"
          ? "انتهت مهلة الانتظار؛ تحقّق من حالة العملية قبل تكرارها"
          : "أُلغي انتظار الطلب؛ قد تكون العملية اكتملت قبل الإلغاء",
      ),
    );
    sendCancel(id);
  }
  function request(method, params, options) {
    options = options || {};
    params = params || {};
    if (closed) return Promise.reject(failure("CLOSED", "أُغلقت الواجهة"));
    if (!modern)
      return Promise.reject(
        failure("UNSUPPORTED", "يتطلب الطلب نسخة أحدث من التطبيق"),
      );
    if (!Object.prototype.hasOwnProperty.call(methods, method))
      return Promise.reject(failure("UNKNOWN_METHOD", "عملية غير مدعومة"));
    if (
      !params ||
      typeof params !== "object" ||
      Array.isArray(params) ||
      Object.keys(params).length
    )
      return Promise.reject(failure("INVALID_PARAMS", "معاملات غير مدعومة"));
    if (pending.size >= 16)
      return Promise.reject(failure("BUSY", "طلبات كثيرة قيد الانتظار"));
    if (options.signal && options.signal.aborted)
      return Promise.reject(failure("CANCELLED", "أُلغي الطلب"));
    var timeout =
      options.timeoutMs == null ? methods[method] : options.timeoutMs;
    if (!Number.isFinite(timeout) || timeout < 1 || timeout > 1800000)
      return Promise.reject(failure("INVALID_TIMEOUT", "مهلة غير صالحة"));
    var id = prefix + "-" + ++sequence;
    var job = {
      method: method,
      deadline: Date.now() + timeout,
      progress: options.onProgress,
      signal: options.signal,
    };
    var promise = new Promise(function (resolve, reject) {
      job.resolve = resolve;
      job.reject = reject;
    });
    promise.requestId = id;
    promise.cancel = function () {
      cancel(id);
    };
    pending.set(id, job);
    job.timer = setTimeout(function () {
      cancel(id, "TIMEOUT");
    }, timeout);
    if (job.signal) {
      job.abort = function () {
        cancel(id);
      };
      job.signal.addEventListener("abort", job.abort, { once: true });
    }
    try {
      native.dispatch(
        JSON.stringify({
          version: 2,
          type: "request",
          id: id,
          method: method,
          params: params,
        }),
      );
    } catch (_) {
      finish(id, failure("TRANSPORT_ERROR", "تعذّر إرسال الطلب إلى Android"));
    }
    return promise;
  }
  function readModels(data) {
    if (
      !data ||
      data.version !== 1 ||
      !Array.isArray(data.models) ||
      data.error
    )
      throw failure(
        "INVALID_MODEL_LIST",
        (data && data.error) || "INVALID_MODEL_LIST",
      );
    return data.models;
  }
  function onResponse(frame) {
    if (!frame || typeof frame.id !== "string" || !pending.has(frame.id))
      return;
    var job = pending.get(frame.id);
    if (Date.now() >= job.deadline) {
      cancel(frame.id, "TIMEOUT");
      return;
    }
    function malformed() {
      finish(frame.id, failure("PROTOCOL_ERROR", "رد Android غير صالح"));
      sendCancel(frame.id);
    }
    if (frame.version !== 2) {
      malformed();
      return;
    }
    if (frame.type === "progress") {
      if (typeof frame.message !== "string") {
        malformed();
        return;
      }
      if (job.progress)
        try {
          job.progress(frame.message);
        } catch (error) {
          console.error("Bridge progress listener", error);
        }
    } else if (frame.type === "error") {
      if (
        !frame.error ||
        typeof frame.error.code !== "string" ||
        typeof frame.error.message !== "string"
      ) {
        malformed();
        return;
      }
      finish(frame.id, failure(frame.error.code, frame.error.message));
    } else if (frame.type === "success") {
      var data = frame.data;
      try {
        if (job.method === "models.list") readModels(data);
        else if (job.method === "contact.pick") {
          if (
            !data ||
            typeof data.name !== "string" ||
            typeof data.phone !== "string"
          )
            throw new Error();
        } else if (
          !data ||
          data.kind !== (job.method === "model.import" ? "vosk" : "project") ||
          !Number.isInteger(data.files) ||
          data.files < 1
        )
          throw new Error();
      } catch (_) {
        malformed();
        return;
      }
      finish(frame.id, null, data);
    } else malformed();
  }
  function legacyAction(name) {
    if (closed) return Promise.reject(failure("CLOSED", "أُغلقت الواجهة"));
    try {
      native[name]();
      return Promise.resolve({ legacy: true });
    } catch (_) {
      return Promise.reject(failure("TRANSPORT_ERROR", "تعذّر فتح المنتقي"));
    }
  }
  function getModelList() {
    if (typeof native.getModelList !== "function") return [];
    var response = JSON.parse(native.getModelList());
    if (response.error) throw failure(response.error, response.error);
    return readModels(response);
  }
  function listModels(options) {
    if (!modern) {
      try {
        return Promise.resolve(getModelList());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    var task = request("models.list", {}, options);
    var result = task.then(readModels);
    result.cancel = task.cancel;
    result.requestId = task.requestId;
    return result;
  }
  var legacyContact = null;
  function pickContact(options) {
    if (closed) return Promise.reject(failure("CLOSED", "أُغلقت الواجهة"));
    if (modern) return request("contact.pick", {}, options);
    if (legacyContact)
      return Promise.reject(failure("BUSY", "جهات الاتصال مشغولة"));
    var resolve, reject, timer;
    var result = new Promise(function (yes, no) {
      resolve = yes;
      reject = no;
    });
    function done(error, value, drained) {
      if (!legacyContact || legacyContact.done !== done) return;
      if (!legacyContact.settled) {
        legacyContact.settled = true;
        clearTimeout(timer);
        if (error) reject(error);
        else resolve(value);
      }
      if (drained) {
        legacyContact = null;
        window.contactPicked = undefined;
      }
    }
    legacyContact = { done: done, settled: false };
    window.contactPicked = function (name, phone) {
      done(null, { name: name || "", phone: phone || "" }, true);
    };
    timer = setTimeout(function () {
      done(failure("TIMEOUT", "لم تصل نتيجة جهة الاتصال"));
    }, 180000);
    result.cancel = function () {
      done(failure("CANCELLED", "أُلغي الطلب"));
    };
    try {
      native.pickContact();
    } catch (_) {
      done(failure("TRANSPORT_ERROR", "تعذّر فتح جهات الاتصال"), null, true);
    }
    return result;
  }
  function close() {
    closed = true;
    Array.from(pending.keys()).forEach(function (id) {
      cancel(id, "CLOSED");
    });
    if (legacyContact) legacyContact.done(failure("CLOSED", "أُغلقت الواجهة"));
  }
  window.addEventListener("pagehide", close);
  window.addEventListener("pageshow", function () {
    closed = false;
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) return;
    pending.forEach(function (job, id) {
      if (Date.now() >= job.deadline) cancel(id, "TIMEOUT");
    });
  });
  window.DaftariBridge = Object.freeze({
    version: 2,
    supportsRpc: modern,
    request: request,
    onResponse: onResponse,
    pickVosk: function (options) {
      return modern
        ? request("model.import", {}, options)
        : legacyAction("pickVosk");
    },
    pickModel: function (options) {
      return modern
        ? request("model.import", {}, options)
        : legacyAction("pickVosk");
    },
    pickProject: function (options) {
      return modern
        ? request("project.import", {}, options)
        : legacyAction("pickProject");
    },
    pickContact: pickContact,
    listModels: listModels,
    importedList: function () {
      return typeof native.importedList === "function"
        ? native.importedList()
        : "";
    },
    getModelList: getModelList,
    receive: function (type, message) {
      if (
        [
          "modelImported",
          "projectImported",
          "error",
          "progress",
          "cancelled",
        ].indexOf(type) !== -1
      )
        emit(type, message);
    },
  });
})();
