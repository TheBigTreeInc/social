/* Classic script: executes before the Vite module graph. Never reports exception messages,
 * full URLs, query strings, account state or storage contents. */
(function () {
  'use strict';
  var complete = false, started = false, problem = null;
  var allowedNames = /^(?:Error|TypeError|ReferenceError|SyntaxError|RangeError|URIError|EvalError|AggregateError)$/;
  function sourceName(url) {
    if (typeof url !== 'string' || !url) return '';
    try {
      var parsed = new URL(url, document.baseURI);
      if (parsed.origin !== location.origin) return '';
      var name = parsed.pathname.split('/').pop() || '';
      return /^[a-zA-Z0-9._-]{1,80}$/.test(name) ? name : '';
    } catch (_) { return ''; }
  }
  function safeErrorName(error) {
    var name = error && error.name;
    return typeof name === 'string' && allowedNames.test(name) ? name : 'Error';
  }
  function safePosition(line, col) {
    if (!Number.isSafeInteger(line) || line < 1 || line > 1000000) return '';
    return ':' + line + (Number.isSafeInteger(col) && col >= 1 && col <= 1000000 ? ':' + col : '');
  }
  function record(candidate) {
    // Actual execution errors supersede a prior failed icon/style or module resource.
    if (!problem || candidate.priority > problem.priority) problem = candidate;
  }
  function onError(event) {
    if (complete) return;
    var target = event && event.target;
    if (target && target !== window && target !== document) {
      var tag = String(target.tagName || '').toUpperCase();
      if (tag === 'SCRIPT') {
        record({priority: 2,code: 'TAVI_STARTUP_SCRIPT_LOAD',source: sourceName(target.src)});
      } else if (tag === 'LINK' && target.rel === 'stylesheet') {
        record({priority: 1,code: 'TAVI_STARTUP_STYLESHEET_LOAD',source: sourceName(target.href)});
      }
      // Icons, images and iframe failures do not establish a main-script failure.
      return;
    }
    record({priority: 4,code: 'TAVI_STARTUP_RUNTIME_ERROR',type: safeErrorName(event && event.error),
      source: sourceName(event && event.filename),position: safePosition(event && event.lineno,event && event.colno)});
  }
  function onRejection(event) {
    if (complete) return;
    record({priority: 3,code: 'TAVI_STARTUP_PROMISE_REJECTION',type: safeErrorName(event && event.reason)});
  }
  function element(tag, text) { var node = document.createElement(tag); node.textContent = text; return node; }
  function show() {
    if (complete) return;
    var host = document.getElementById('app');
    if (!host || host.childElementCount > 0) return;
    complete = true;
    var result = problem || {code: started ? 'TAVI_STARTUP_RENDER_TIMEOUT' : 'TAVI_STARTUP_MODULE_TIMEOUT'};
    var version = document.querySelector('meta[name="tavi-client-version"]');
    var v = version && /^[0-9]+\.[0-9]+\.[0-9]+$/.test(version.content) ? version.content : 'unknown';
    var detail = [result.code, result.type, result.source && ('asset=' + result.source), result.position].filter(Boolean).join(' ');
    var panel = document.createElement('main');
    panel.setAttribute('role','alert');
    panel.style.cssText = 'box-sizing:border-box;min-height:100vh;padding:32px 22px;background:#e5f3ee;color:#213e30;font:15px/1.5 system-ui,sans-serif;display:flex;flex-direction:column;justify-content:center';
    var title = element('h1','Tavi could not start');
    var description = element('p','The messenger interface did not load. Your account and local data have not been reset.');
    var diagnostic = element('p','Diagnostic: ' + detail + ' · client ' + v);
    diagnostic.style.cssText = 'font-size:12px;overflow-wrap:anywhere';
    var guidance = element('p','Please include this diagnostic line in your ZipRunner report. No account or session data is shown.');
    guidance.style.fontSize = '12px';
    var button = element('button','Reload Tavi'); button.type = 'button';
    button.style.cssText = 'min-height:44px;padding:9px 14px;background:#2d7755;color:white;border:0;border-radius:8px';
    button.addEventListener('click',function () { window.location.reload(); });
    panel.appendChild(title); panel.appendChild(description); panel.appendChild(diagnostic);
    panel.appendChild(guidance); panel.appendChild(button); host.appendChild(panel);
  }
  window.addEventListener('error',onError,true);
  window.addEventListener('unhandledrejection',onRejection);
  window.taviBootStarted = function () { started = true; };
  window.taviBootComplete = function () { complete = true; };
  window.setTimeout(show,7000);
})();
