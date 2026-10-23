/* Jumper Jim — site behavior. No dependencies. */
(function () {
  "use strict";

  var BUSINESS = {
    phoneE164: "+12092219788",
    phoneDisplay: "(209) 221-9788",
    email: "info@jumperjim.com"
  };

  /* ---------- Footer year ---------- */
  var yearEl = document.querySelector("[data-year]");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

    /* ---------- Mobile navigation ---------- */
  var navToggle = document.querySelector(".site-nav__toggle");
  var navMenu = document.getElementById("site-nav-menu");

  function setNavOpen(open) {
    if (!navToggle) return;
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.querySelector(".site-nav__toggle-label").textContent = open ? "Close menu" : "Menu";
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", function () {
      setNavOpen(navToggle.getAttribute("aria-expanded") !== "true");
    });
    navMenu.addEventListener("click", function (e) {
      if (e.target.closest("a")) setNavOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && navToggle.getAttribute("aria-expanded") === "true") {
        setNavOpen(false);
        navToggle.focus();
      }
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".site-nav")) setNavOpen(false);
    });
  }

  /* ---------- Sticky action bar: step aside while the keyboard is open ---------- */
  var typingTimer;
  document.addEventListener("focusin", function (e) {
    if (e.target.matches("input:not([type=radio]):not([type=checkbox]), textarea, select")) {
      clearTimeout(typingTimer);
      document.body.classList.add("is-typing");
    }
  });
  document.addEventListener("focusout", function () {
    clearTimeout(typingTimer);
    typingTimer = setTimeout(function () {
      var el = document.activeElement;
      if (!el || !el.matches("input:not([type=radio]):not([type=checkbox]), textarea, select")) {
        document.body.classList.remove("is-typing");
      }
    }, 120);
  });

  /* ---------- Price estimator (pricing section) ---------- */
  // Home base, deliberately rounded to about 100 m. The street address never appears on the site.
  var HOME_BASE = { lat: 37.7, lng: -121.474 };
  var SERVED_CITIES = ["tracy", "manteca"];
  var SEARCH_BOX = { west: -121.75, north: 37.95, east: -121.05, south: 37.55 }; // where typed addresses are looked up

  var estimator = document.getElementById("estimate");
  if (estimator && window.fetch) initEstimator();

  function initEstimator() {
    var estForm = document.getElementById("estimator-form");
    var estInput = document.getElementById("est-address");
    var estSubmit = estForm.querySelector('button[type="submit"]');
    var estLocate = document.getElementById("est-locate");
    var estStatus = document.getElementById("est-status");
    var estResult = document.getElementById("est-result");
    var busy = false;

    function part(name) {
      return estResult.querySelector('[data-est="' + name + '"]');
    }

    function getJSON(url, ms) {
      var ctrl = window.AbortController ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 10000) : null;
      return fetch(url, ctrl ? { signal: ctrl.signal } : undefined).then(
        function (res) {
          clearTimeout(timer);
          if (!res.ok) throw new Error("Request failed with status " + res.status);
          return res.json();
        },
        function (err) {
          clearTimeout(timer);
          throw err;
        }
      );
    }

    function cityOf(address) {
      return address ? String(address.city || address.town || address.village || "").toLowerCase() : "";
    }

    // Typed address -> { lat, lng, city } or null. OpenStreetMap's Nominatim first, Photon as a backup.
    function geocode(query) {
      var q = encodeURIComponent(query);
      var b = SEARCH_BOX;
      function photon() {
        return getJSON("https://photon.komoot.io/api/?limit=1&lang=en&bbox=" + [b.west, b.south, b.east, b.north].join(",") + "&q=" + q)
          .then(function (data) {
            var f = data.features && data.features[0];
            if (!f) return null;
            return { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], city: String(f.properties.city || "").toLowerCase() };
          });
      }
      return getJSON(
        "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&addressdetails=1&bounded=1" +
        "&viewbox=" + [b.west, b.north, b.east, b.south].join(",") + "&q=" + q
      )
        .then(function (list) {
          if (!list.length) return photon();
          return { lat: Number(list[0].lat), lng: Number(list[0].lon), city: cityOf(list[0].address) };
        }, photon);
    }

    function cityAt(place) {
      return getJSON("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&addressdetails=1&lat=" + place.lat + "&lon=" + place.lng)
        .then(function (r) { return cityOf(r.address); }, function () { return ""; });
    }

    // Driving distance in miles from the home base to the vehicle (public OSRM route server)
    function drivingMiles(to) {
      return getJSON(
        "https://router.project-osrm.org/route/v1/driving/" + HOME_BASE.lng + "," + HOME_BASE.lat + ";" +
        to.lng.toFixed(5) + "," + to.lat.toFixed(5) + "?overview=false&alternatives=false&steps=false"
      ).then(function (data) {
        if (data.code !== "Ok" || !data.routes || !data.routes.length) throw new Error("No route found");
        return data.routes[0].distance / 1609.344;
      });
    }

    // Straight-line ("as the crow flies") distance in miles, used when no route is available
    function straightMiles(to) {
      var rad = Math.PI / 180;
      var dLat = (to.lat - HOME_BASE.lat) * rad;
      var dLng = (to.lng - HOME_BASE.lng) * rad;
      var a = Math.pow(Math.sin(dLat / 2), 2) +
        Math.cos(HOME_BASE.lat * rad) * Math.cos(to.lat * rad) * Math.pow(Math.sin(dLng / 2), 2);
      return 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function dollars(el) {
      var m = el && el.textContent.match(/\$\d+/);
      return m ? m[0] : "";
    }

    // Prices come from the price table, so the estimate always matches it (including after the offer ends)
    function render(rawMiles, byRoad, city) {
      var miles = Math.max(1, Math.round(rawMiles));
      var row = null;
      Array.prototype.forEach.call(document.querySelectorAll(".price-table tbody tr"), function (r) {
        r.classList.remove("is-estimate");
        if (!row && r.hasAttribute("data-miles") && miles <= Number(r.getAttribute("data-miles"))) row = r;
      });

      part("distance").textContent =
        (rawMiles < 0.5 ? "Less than 1 mile" : "About " + miles + (miles === 1 ? " mile" : " miles")) +
        (byRoad ? " by road" : " in a straight line") + " from Jumper Jim's home base.";

      if (row) {
        var offerOn = !document.documentElement.classList.contains("offer-ended");
        row.classList.add("is-estimate");
        part("price").textContent = dollars(row.querySelector('.price[data-offer="' + (offerOn ? "on" : "off") + '"]'));
        part("was").textContent = offerOn ? dollars(row.querySelector(".price-was")) : "";
        part("was").setAttribute("aria-label", "Regular price " + part("was").textContent);
        part("was").hidden = !offerOn;
      }
      part("price-line").hidden = !row;
      part("far").hidden = !!row;
      part("crow").hidden = byRoad;
      part("road").hidden = !byRoad || !row;
      part("outside").hidden = !city || SERVED_CITIES.indexOf(city) !== -1;
      estResult.hidden = false;
      setStatus("");
    }

    function estimateFor(place) {
      setStatus("Working out the distance…");
      return drivingMiles(place)
        .then(
          function (miles) { return { miles: miles, byRoad: true }; },
          function () { return { miles: straightMiles(place), byRoad: false }; }
        )
        .then(function (d) { render(d.miles, d.byRoad, place.city); });
    }

    function setStatus(message, isError) {
      estStatus.textContent = message;
      estStatus.classList.toggle("estimator__status--error", !!isError);
    }

    function setBusy(on) {
      busy = on;
      estSubmit.disabled = on;
      estLocate.disabled = on;
      if (on) estimator.setAttribute("aria-busy", "true");
      else estimator.removeAttribute("aria-busy");
    }

    function lookupFailed() {
      setStatus("We couldn't work out the distance right now. Please call " + BUSINESS.phoneDisplay + " for a quote.", true);
    }

    estimator.hidden = false;

    estForm.addEventListener("submit", function (e) {
      e.preventDefault();
      if (busy) return;
      var query = estInput.value.trim();
      if (query.length < 3) {
        setStatus("Please enter a street address and city, or a ZIP code.", true);
        estInput.focus();
        return;
      }
      setBusy(true);
      estResult.hidden = true;
      setStatus("Finding that location…");
      geocode(query)
        .then(function (place) {
          if (place) return estimateFor(place);
          setStatus("We couldn't find that location near Tracy or Manteca. Try adding the street number and city, or call " + BUSINESS.phoneDisplay + " for a quote.", true);
        })
        .catch(lookupFailed)
        .then(function () { setBusy(false); });
    });

    if ("geolocation" in navigator && window.isSecureContext) {
      estLocate.hidden = false;
      estLocate.addEventListener("click", function () {
        if (busy) return;
        setBusy(true);
        estResult.hidden = true;
        setStatus("Finding your location…");
        navigator.geolocation.getCurrentPosition(
          function (pos) {
            var place = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            cityAt(place)
              .then(function (city) {
                place.city = city;
                return estimateFor(place);
              })
              .catch(lookupFailed)
              .then(function () { setBusy(false); });
          },
          function (err) {
            setStatus(
              err.code === 1
                ? "Location access is blocked. Please type your address instead."
                : "We couldn't get your location. Please type your address instead.",
              true
            );
            setBusy(false);
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
        );
      });
    }
  }

  /* ---------- Request a Jump Start form ---------- */
  var form = document.getElementById("request-form");
  if (!form) return;

  var sentPanel = document.getElementById("request-sent");
  var handoffPanel = document.getElementById("request-handoff");
  var formStatus = document.getElementById("request-form-status");
  var submitBtn = form.querySelector('button[type="submit"]');

  var rules = {
    name: function (v) {
      return v.trim().length >= 2 || "Please enter your name.";
    },
    phone: function (v) {
      var d = v.replace(/\D/g, "");
      if (d.length === 11 && d.charAt(0) === "1") d = d.slice(1);
      return d.length === 10 || "Please enter a 10-digit phone number so we can reach you.";
    },
    location: function (v) {
      return v.trim().length >= 3 || "Tell us where your vehicle is: an address, cross streets or a landmark.";
    },
    vehicle_year: function (v) {
      v = v.trim();
      if (!v) return true;
      var y = Number(v);
      var max = new Date().getFullYear() + 2;
      return (/^\d{4}$/.test(v) && y >= 1950 && y <= max) || "Enter a 4-digit year, or leave it blank.";
    },
    vehicle_make: function (v) {
      return v.trim().length > 0 || "Please enter the make (for example, Ford).";
    },
    vehicle_model: function (v) {
      return v.trim().length > 0 || "Please enter the model (for example, F-150).";
    },
    fuel_type: function (v) {
      return !!v || "Please choose gas, diesel or hybrid.";
    }
  };

  function errorElFor(name) {
    if (name === "fuel_type") return document.getElementById("f-fuel-error");
    var input = form.elements[name];
    return input ? document.getElementById(input.id + "-error") : null;
  }

  function validateField(name) {
    var value = form.elements[name].value || "";
    var result = rules[name](value);
    var message = result === true ? "" : result;
    var errEl = errorElFor(name);
    if (errEl) errEl.textContent = message;

    if (name === "fuel_type") {
      var group = errEl.closest(".field-group");
      if (message) group.setAttribute("data-invalid", "true");
      else group.removeAttribute("data-invalid");
    } else {
      var input = form.elements[name];
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
    return !message;
  }

  // Re-check a field as soon as the customer fixes it
  Object.keys(rules).forEach(function (name) {
    var el = form.elements[name];
    if (!el) return;
    var nodes = el.length && !el.tagName ? Array.prototype.slice.call(el) : [el];
    nodes.forEach(function (node) {
      node.addEventListener(node.type === "radio" ? "change" : "blur", function () {
        var hasError = errorElFor(name) && errorElFor(name).textContent;
        if (hasError || node.type === "radio") validateField(name);
      });
      if (node.type !== "radio") {
        node.addEventListener("input", function () {
          if (errorElFor(name) && errorElFor(name).textContent) validateField(name);
        });
      }
    });
  });

  function validateAll() {
    var firstInvalid = null;
    Object.keys(rules).forEach(function (name) {
      if (!validateField(name) && !firstInvalid) firstInvalid = name;
    });
    if (firstInvalid) {
      var target = form.elements[firstInvalid];
      (target.length && !target.tagName ? target[0] : target).focus();
    }
    return !firstInvalid;
  }

  function val(name) {
    var el = form.elements[name];
    return el ? String(el.value || "").trim() : "";
  }

  function buildMessage() {
    var vehicle = [val("vehicle_year"), val("vehicle_make"), val("vehicle_model")].filter(Boolean).join(" ");
    var lines = [
      "JUMP START REQUEST (jumperjim.com)",
      "Name: " + val("name"),
      "Phone: " + val("phone"),
      "Location: " + val("location"),
      "Vehicle: " + vehicle + " (" + val("fuel_type") + ")"
    ];
    if (val("message")) lines.push("Message: " + val("message"));
    return lines.join("\n");
  }

  function showPanel(panel) {
    form.hidden = true;
    sentPanel.hidden = panel !== sentPanel;
    handoffPanel.hidden = panel !== handoffPanel;
    var heading = panel.querySelector(".form-result__title");
    panel.closest(".request__card").scrollIntoView({ block: "start" });
    if (heading) heading.focus({ preventScroll: true });
  }

  function showForm() {
    sentPanel.hidden = true;
    handoffPanel.hidden = true;
    form.hidden = false;
    form.elements.name.focus();
  }

  function showHandoff(message) {
    var smsHref = "sms:" + BUSINESS.phoneE164 + "?&body=" + encodeURIComponent(message);
    var mailHref =
      "mailto:" + BUSINESS.email +
      "?subject=" + encodeURIComponent("Jump Start Request: " + val("name")) +
      "&body=" + encodeURIComponent(message);

    var smsBtn = document.getElementById("handoff-sms");
    var mailBtn = document.getElementById("handoff-email");
    smsBtn.href = smsHref;
    mailBtn.href = mailHref;

    // Phones: text first. Desktops: email first. The first option gets the red button.
    var actions = smsBtn.parentNode;
    var isTouch = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    var first = isTouch ? smsBtn : mailBtn;
    var second = isTouch ? mailBtn : smsBtn;
    actions.insertBefore(first, second);
    first.classList.add("btn--call");
    first.classList.remove("btn--yellow");
    second.classList.add("btn--yellow");
    second.classList.remove("btn--call");

    document.getElementById("handoff-preview").textContent = message;
    showPanel(handoffPanel);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    formStatus.textContent = "";

    // Bots fill the hidden field; people never see it.
    if (form.elements.company && form.elements.company.value) return;
    if (!validateAll()) return;

    var message = buildMessage();
    var endpoint = (form.getAttribute("data-endpoint") || "").trim();

    if (!endpoint) {
      showHandoff(message);
      return;
    }

    var data = new FormData(form);
    data.delete("company");
    data.append("summary", message);

    submitBtn.setAttribute("aria-busy", "true");
    submitBtn.disabled = true;

    fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("Request failed with status " + res.status);
        sentPanel.querySelector('[data-fill="phone"]').textContent = val("phone");
        showPanel(sentPanel);
        form.reset();
      })
      .catch(function () {
        // Never leave a stranded customer with nothing: fall back to text/email.
        showHandoff(message);
      })
      .then(function () {
        submitBtn.removeAttribute("aria-busy");
        submitBtn.disabled = false;
      });
  });

  document.addEventListener("click", function (e) {
    var action = e.target.closest("[data-action]");
    if (!action) return;
    if (action.getAttribute("data-action") === "edit-request") showForm();
    if (action.getAttribute("data-action") === "new-request") {
      form.reset();
      showForm();
    }
  });

  /* ---------- "Use my current location" ---------- */
  var locateBtn = document.getElementById("use-location");
  var locStatus = document.getElementById("f-location-status");
  var locInput = form.elements.location;

  if (locateBtn && "geolocation" in navigator && window.isSecureContext) {
    locateBtn.hidden = false;
    locateBtn.addEventListener("click", function () {
      locateBtn.disabled = true;
      locStatus.textContent = "Finding your location…";

      navigator.geolocation.getCurrentPosition(
        function (pos) {
          var lat = pos.coords.latitude.toFixed(5);
          var lng = pos.coords.longitude.toFixed(5);
          var line = "GPS " + lat + ", " + lng + " (within about " + Math.round(pos.coords.accuracy) + " m): https://maps.google.com/?q=" + lat + "," + lng;
          var current = locInput.value.trim();
          locInput.value = current ? current + "\n" + line : line;
          locStatus.textContent = "Location added. Add anything that helps us find you, like a parking row or landmark.";
          locateBtn.disabled = false;
          validateField("location");
        },
        function (err) {
          locStatus.textContent =
            err.code === 1
              ? "Location access is blocked. Please type your address or nearest cross streets."
              : "We couldn't get your location. Please type your address or nearest cross streets.";
          locateBtn.disabled = false;
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 }
      );
    });
  }
})();
