/* GoHighLevel (LeadConnector) contact sync.

   Every website form posts its submission to LeadrVision (the form action) and,
   in parallel, to this endpoint. Here the submission is turned into a
   create-or-update of a contact in the GoHighLevel sub-account:

     - first name / last name (split from the single "name" field)
     - phone, email
     - the message (stored on the contact and as a note on the contact)
     - custom field "Lead Source"  -> "Website"
     - custom field "Website Form" -> the form name (the hidden "_form" field)
     - tag "website-lead"

   The private API token is read from the environment (never shipped to the
   browser). Set GHL_API_TOKEN (a Private Integration / API token for the
   sub-account) in the hosting environment. GHL_LOCATION_ID may override the
   default location ID below.
*/

"use strict";

var API_BASE = "https://services.leadconnectorhq.com";
var API_VERSION = "2021-07-28";
var DEFAULT_LOCATION_ID = "zWrqTLGrbnMMy9BmMcwK";
var LEAD_SOURCE = "Website";
var TAG = "website-lead";

/* Field names that are plumbing rather than answers from the visitor. */
var INTERNAL_FIELDS = ["_form", "_page", "_gotcha", "submitted"];

function token() {
  return (
    process.env.GHL_API_TOKEN ||
    process.env.GHL_API_KEY ||
    process.env.HIGHLEVEL_API_TOKEN ||
    process.env.HIGHLEVEL_API_KEY ||
    ""
  );
}

function locationId() {
  return process.env.GHL_LOCATION_ID || DEFAULT_LOCATION_ID;
}

function headers() {
  return {
    Authorization: "Bearer " + token(),
    Version: API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

function text(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}

function splitName(full, first, last) {
  var firstName = text(first);
  var lastName = text(last);
  if (firstName || lastName) return { firstName: firstName, lastName: lastName };

  var parts = text(full).split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/* GHL wants E.164. Only a plain 10/11 digit North American number can be
   normalised safely; anything else is passed through untouched. */
function normalisePhone(value) {
  var raw = text(value);
  if (!raw) return "";
  if (raw.charAt(0) === "+") return raw.replace(/[^\d+]/g, "");
  var digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return "+1" + digits;
  if (digits.length === 11 && digits.charAt(0) === "1") return "+" + digits;
  return raw;
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string" && req.body) {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        /* fall through to raw parsing */
      }
    }

    var chunks = "";
    req.on("data", function (chunk) {
      chunks += chunk;
      if (chunks.length > 100000) chunks = chunks.slice(0, 100000);
    });
    req.on("end", function () {
      if (!chunks) return resolve({});
      try {
        return resolve(JSON.parse(chunks));
      } catch (e) {
        var out = {};
        try {
          new URLSearchParams(chunks).forEach(function (value, key) {
            out[key] = value;
          });
        } catch (err) {
          /* unparseable body */
        }
        resolve(out);
      }
    });
    req.on("error", function () {
      resolve({});
    });
  });
}

/* Custom fields are addressed by id, so look them up by name once per call. */
function loadCustomFields() {
  return fetch(API_BASE + "/locations/" + locationId() + "/customFields?model=contact", {
    method: "GET",
    headers: headers()
  })
    .then(function (response) {
      if (!response.ok) return {};
      return response.json();
    })
    .then(function (data) {
      var list = (data && (data.customFields || data.customField)) || [];
      var byName = {};
      list.forEach(function (field) {
        if (field && field.name) byName[String(field.name).toLowerCase()] = field;
      });
      return byName;
    })
    .catch(function () {
      return {};
    });
}

function customFieldPayload(byName, wanted) {
  var out = [];
  Object.keys(wanted).forEach(function (name) {
    var value = wanted[name];
    if (!value) return;
    var field = byName[name.toLowerCase()];
    if (field && field.id) {
      out.push({ id: field.id, value: value });
    } else if (field && field.fieldKey) {
      out.push({ key: field.fieldKey, field_value: value });
    }
  });
  return out;
}

function extraLines(body) {
  var lines = [];
  Object.keys(body).forEach(function (key) {
    if (INTERNAL_FIELDS.indexOf(key) !== -1) return;
    if (["name", "first name", "last name", "email", "phone", "message"].indexOf(key.toLowerCase()) !== -1) return;
    var value = text(body[key]);
    if (value) lines.push(key + ": " + value);
  });
  return lines;
}

function addNote(contactId, noteBody) {
  if (!contactId || !noteBody) return Promise.resolve();
  return fetch(API_BASE + "/contacts/" + contactId + "/notes", {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ body: noteBody })
  })
    .then(function () {})
    .catch(function () {});
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  res.setHeader("Content-Type", "application/json");

  var body = await readBody(req);

  /* Honeypot: silently accept and drop. */
  if (text(body._gotcha)) {
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, skipped: "spam" }));
  }

  var names = splitName(body.name, body["First name"] || body.firstName, body["Last name"] || body.lastName);
  var email = text(body.email);
  var phone = normalisePhone(body.phone);
  var message = text(body.message);
  var formName = text(body._form) || "Website form";
  var page = text(body._page);

  if (!email && !phone) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: "An email address or phone number is required" }));
  }

  if (!token()) {
    /* Not configured yet: never block the visitor's submission. */
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "GoHighLevel API token is not configured" }));
  }

  try {
    var byName = await loadCustomFields();

    var contact = {
      locationId: locationId(),
      firstName: names.firstName,
      lastName: names.lastName,
      name: text(body.name) || [names.firstName, names.lastName].filter(Boolean).join(" "),
      email: email,
      phone: phone,
      source: LEAD_SOURCE,
      tags: [TAG],
      customFields: customFieldPayload(byName, {
        "Lead Source": LEAD_SOURCE,
        "Website Form": formName,
        Message: message
      })
    };

    Object.keys(contact).forEach(function (key) {
      if (contact[key] === "" || contact[key] == null) delete contact[key];
    });
    if (!contact.customFields || !contact.customFields.length) delete contact.customFields;

    var response = await fetch(API_BASE + "/contacts/upsert", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(contact)
    });

    var result = await response.json().catch(function () {
      return null;
    });

    if (!response.ok) {
      res.statusCode = 502;
      return res.end(
        JSON.stringify({
          ok: false,
          error: (result && (result.message || result.error)) || "GoHighLevel rejected the contact"
        })
      );
    }

    var contactId =
      (result && result.contact && result.contact.id) || (result && result.id) || (result && result.contactId) || "";

    var noteLines = [formName + " submission"];
    if (message) noteLines.push("", message);
    var extras = extraLines(body);
    if (extras.length) noteLines.push("", extras.join("\n"));
    noteLines.push("", "Lead Source: " + LEAD_SOURCE);
    noteLines.push("Website Form: " + formName);
    if (page) noteLines.push("Page: " + page);

    await addNote(contactId, noteLines.join("\n"));

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, contactId: contactId }));
  } catch (error) {
    res.statusCode = 502;
    return res.end(JSON.stringify({ ok: false, error: "GoHighLevel sync failed" }));
  }
};
