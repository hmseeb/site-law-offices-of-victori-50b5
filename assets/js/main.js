/* Law Offices of Victoria Clemans — site behaviour
   Progressive enhancement only: every form works without JavaScript. */
(function () {
  "use strict";

  var FORM_ENDPOINT = "https://vision.leadrai.com/api/forms/91fd01ec81f92a32155959cca7aadbf9";
  /* Server-side GoHighLevel sync (create/update contact, tag "website-lead"). */
  var CRM_ENDPOINT = "/api/ghl-contact";
  var THANKS = "Thanks, your message was sent. We will be in touch. If your matter is urgent, please call (310) 488-6357.";

  /* ---------- Mobile navigation ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var nav = document.getElementById("site-nav");
    if (!toggle || !nav) return;

    toggle.addEventListener("click", function () {
      var open = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });

    nav.addEventListener("click", function (event) {
      if (event.target.tagName === "A") {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Hidden _page fields ---------- */
  function initPageFields() {
    var fields = document.querySelectorAll('input[name="_page"]');
    for (var i = 0; i < fields.length; i++) {
      fields[i].value = window.location.href;
    }
  }

  /* ---------- Confirmation after a plain HTML submission ---------- */
  function showStatus(statusEl, message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.classList.add("is-visible");
    if (isError) {
      statusEl.classList.add("is-error");
    } else {
      statusEl.classList.remove("is-error");
    }
  }

  function initSubmittedBanner() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("submitted") !== "1") return;

    var statuses = document.querySelectorAll(".form-status");
    for (var i = 0; i < statuses.length; i++) {
      showStatus(statuses[i], THANKS, false);
    }
    if (statuses.length) {
      statuses[0].setAttribute("tabindex", "-1");
      try {
        statuses[0].scrollIntoView({ block: "center" });
        statuses[0].focus();
      } catch (e) {
        /* older browsers: nothing to do */
      }
    }
  }

  /* ---------- GoHighLevel contact sync ----------
     Runs alongside the LeadrVision submission. It never blocks the visitor:
     a failure here is ignored, and the message itself still goes through the
     form endpoint. */
  function sendToCrm(payload) {
    if (!window.fetch) return;
    try {
      fetch(CRM_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(function () {});
    } catch (e) {
      /* nothing to do — the form submission is unaffected */
    }
  }

  /* ---------- fetch() submission with a plain-POST fallback ---------- */
  function initForms() {
    var forms = document.querySelectorAll("form[data-leadr]");

    Array.prototype.forEach.call(forms, function (form) {
      form.addEventListener("submit", function (event) {
        if (!window.fetch || !form.checkValidity()) return; // let the browser handle it

        event.preventDefault();

        var statusEl = form.parentNode.querySelector(".form-status") ||
          document.querySelector(".form-status");
        var button = form.querySelector('button[type="submit"]');
        var originalLabel = button ? button.textContent : "";

        var pageField = form.querySelector('input[name="_page"]');
        if (pageField) pageField.value = window.location.href;

        var payload = {};
        var data = new FormData(form);
        data.forEach(function (value, key) {
          payload[key] = value;
        });
        payload._page = window.location.href;

        sendToCrm(payload);

        if (button) {
          button.disabled = true;
          button.textContent = "Sending…";
        }

        fetch(FORM_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(payload)
        })
          .then(function (response) {
            return response.json().catch(function () {
              return { ok: response.ok };
            });
          })
          .then(function (result) {
            if (result && result.ok) {
              form.reset();
              initPageFields();
              showStatus(statusEl, THANKS, false);
              if (statusEl) {
                statusEl.setAttribute("tabindex", "-1");
                try {
                  statusEl.scrollIntoView({ block: "center" });
                  statusEl.focus();
                } catch (e) {}
              }
              if (button) {
                button.disabled = false;
                button.textContent = originalLabel;
              }
            } else {
              throw new Error("Submission rejected");
            }
          })
          .catch(function () {
            // Fall back to a normal browser POST so the message still gets through.
            if (button) {
              button.disabled = false;
              button.textContent = originalLabel;
            }
            form.removeAttribute("data-leadr");
            HTMLFormElement.prototype.submit.call(form);
          });
      });
    });
  }

  /* ---------- Subtle reveal on scroll (honours reduced motion) ---------- */
  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      Array.prototype.forEach.call(items, function (el) { el.classList.add("is-in"); });
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    Array.prototype.forEach.call(items, function (el) { observer.observe(el); });
  }

  /* ---------- Current year in the footer ---------- */
  function initYear() {
    var nodes = document.querySelectorAll("[data-year]");
    var year = String(new Date().getFullYear());
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].textContent = year;
    }
  }

  function init() {
    initNav();
    initPageFields();
    initSubmittedBanner();
    initForms();
    initReveal();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
