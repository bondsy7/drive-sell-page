/**
 * Autohaus.AI Embed Script v2
 * 
 * Usage (Fahrzeugliste):
 *   <div id="autohaus-ai-vehicles"></div>
 *   <script src="https://autohaus.ai/embed.js" data-api-key="ak_..."></script>
 * 
 * Usage (Einzelfahrzeug):
 *   <div id="autohaus-ai-vehicle" data-vehicle-id="UUID"></div>
 *   <script src="https://autohaus.ai/embed.js" data-api-key="ak_..."></script>
 * 
 * Optional attributes:
 *   data-supabase-url="https://your-project.supabase.co"  (auto-detected if omitted)
 *   data-theme="light" | "dark"
 *   data-columns="3"
 */
(function () {
  var script = document.currentScript;
  if (!script) return;

  var apiKey = script.getAttribute("data-api-key");
  var supabaseUrl = script.getAttribute("data-supabase-url");
  var theme = script.getAttribute("data-theme") || "light";
  var columns = parseInt(script.getAttribute("data-columns") || "3", 10);

  // Auto-detect API URL from script src
  var scriptSrc = script.src || "";
  if (!supabaseUrl) {
    // Try to extract from a known pattern or fall back
    // In production, the embed.js is served from the app domain
    // We need the Supabase URL - users should provide it via data-supabase-url
    // For convenience, check if there's a meta tag
    var meta = document.querySelector('meta[name="autohaus-ai-url"]');
    if (meta) {
      supabaseUrl = meta.getAttribute("content");
    }
  }

  if (!apiKey) {
    console.warn("[Autohaus.AI] Missing data-api-key attribute on script tag.");
    return;
  }

  if (!supabaseUrl) {
    console.warn("[Autohaus.AI] Missing data-supabase-url attribute. Please add data-supabase-url to the script tag.");
    return;
  }

  var apiUrl = supabaseUrl + "/functions/v1/api-vehicles";

  // Inject styles
  var styleId = "autohaus-ai-styles";
  if (!document.getElementById(styleId)) {
    var style = document.createElement("style");
    style.id = styleId;
    style.textContent = getStyles(theme, columns);
    document.head.appendChild(style);
  }

  // Check for single vehicle container
  var singleContainer = document.getElementById("autohaus-ai-vehicle");
  if (singleContainer) {
    var vehicleId = singleContainer.getAttribute("data-vehicle-id");
    if (!vehicleId) {
      singleContainer.innerHTML = '<p class="aai-error">Fehler: data-vehicle-id fehlt.</p>';
      return;
    }
    singleContainer.innerHTML = '<div class="aai-loading"><div class="aai-spinner"></div><p>Fahrzeug wird geladen...</p></div>';
    loadSingleVehicle(apiUrl, apiKey, vehicleId, singleContainer);
    return;
  }

  // Check for list container
  var listContainer = document.getElementById("autohaus-ai-vehicles");
  if (listContainer) {
    listContainer.innerHTML = '<div class="aai-loading"><div class="aai-spinner"></div><p>Fahrzeuge werden geladen...</p></div>';
    loadVehicleList(apiUrl, apiKey, listContainer);
    return;
  }

  console.warn("[Autohaus.AI] No container found. Add #autohaus-ai-vehicles or #autohaus-ai-vehicle div.");

  function loadVehicleList(url, key, container) {
    fetch(url, { headers: { "x-api-key": key } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.vehicles || data.vehicles.length === 0) {
          container.innerHTML = '<p class="aai-empty">Keine Fahrzeuge verfügbar.</p>';
          return;
        }
        var html = '<div class="aai-grid">';
        data.vehicles.forEach(function (v) {
          html += buildVehicleCard(v);
        });
        html += '</div>';
        container.innerHTML = html;
      })
      .catch(function (err) {
        container.innerHTML = '<p class="aai-error">Fehler beim Laden der Fahrzeuge.</p>';
        console.error("[Autohaus.AI]", err);
      });
  }

  function loadSingleVehicle(url, key, id, container) {
    // Try HTML fragment first
    fetch(url + "/" + id + "/html", { headers: { "x-api-key": key } })
      .then(function (r) {
        if (!r.ok) throw new Error("Not found");
        return r.text();
      })
      .then(function (html) {
        container.innerHTML = '<div class="aai-single">' + html + '</div>';
      })
      .catch(function () {
        // Fallback to JSON
        fetch(url + "/" + id, { headers: { "x-api-key": key } })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.vehicle) {
              container.innerHTML = '<p class="aai-error">Fahrzeug nicht gefunden.</p>';
              return;
            }
            container.innerHTML = '<div class="aai-single">' + buildVehicleDetail(data.vehicle) + '</div>';
          })
          .catch(function () {
            container.innerHTML = '<p class="aai-error">Fehler beim Laden des Fahrzeugs.</p>';
          });
      });
  }

  function buildVehicleCard(v) {
    var vd = v.vehicle_data || {};
    var vehicle = vd.vehicle || {};
    var finance = vd.finance || {};
    var title = v.title || ((vehicle.brand || "") + " " + (vehicle.model || "")).trim() || "Fahrzeug";
    var price = vehicle.price || "";
    var imgUrl = v.main_image_url || "";
    var year = vehicle.year || vehicle.ez || "";
    var mileage = vehicle.mileage || vehicle.km || "";
    var fuel = vehicle.fuelType || vehicle.fuel || "";
    var power = vehicle.power || "";
    var rate = finance.rate || "";

    var card = '<div class="aai-card">';
    if (imgUrl) {
      card += '<div class="aai-card-img"><img src="' + escHtml(imgUrl) + '" alt="' + escHtml(title) + '" loading="lazy" /></div>';
    }
    card += '<div class="aai-card-body">';
    card += '<h3 class="aai-card-title">' + escHtml(title) + '</h3>';
    
    // Meta row
    var meta = [];
    if (year) meta.push(escHtml(year));
    if (mileage) meta.push(escHtml(mileage));
    if (fuel) meta.push(escHtml(fuel));
    if (power) meta.push(escHtml(power));
    if (meta.length) {
      card += '<p class="aai-card-meta">' + meta.join(' · ') + '</p>';
    }

    if (price) card += '<p class="aai-card-price">' + escHtml(price) + '</p>';
    if (rate) card += '<p class="aai-card-rate">ab ' + escHtml(rate) + '/Monat</p>';
    card += '</div></div>';
    return card;
  }

  function buildVehicleDetail(v) {
    var vd = v.vehicle_data || {};
    var vehicle = vd.vehicle || {};
    var finance = vd.finance || {};
    var consumption = vd.consumption || {};
    var title = v.title || ((vehicle.brand || "") + " " + (vehicle.model || "")).trim();
    var imgUrl = v.main_image_url || "";

    var html = '';
    if (imgUrl) {
      html += '<img src="' + escHtml(imgUrl) + '" alt="' + escHtml(title) + '" class="aai-detail-img" />';
    }
    html += '<h2 class="aai-detail-title">' + escHtml(title) + '</h2>';
    if (vehicle.price) html += '<p class="aai-detail-price">' + escHtml(vehicle.price) + '</p>';

    // Specs table
    var specs = [];
    if (vehicle.year || vehicle.ez) specs.push(["Erstzulassung", vehicle.year || vehicle.ez]);
    if (vehicle.mileage || vehicle.km) specs.push(["Kilometerstand", vehicle.mileage || vehicle.km]);
    if (vehicle.fuelType || vehicle.fuel) specs.push(["Kraftstoff", vehicle.fuelType || vehicle.fuel]);
    if (vehicle.power) specs.push(["Leistung", vehicle.power]);
    if (vehicle.transmission) specs.push(["Getriebe", vehicle.transmission]);
    if (vehicle.color) specs.push(["Farbe", vehicle.color]);
    if (consumption.combined) specs.push(["Verbrauch komb.", consumption.combined]);
    if (consumption.co2) specs.push(["CO₂-Emissionen", consumption.co2]);

    if (specs.length) {
      html += '<table class="aai-specs">';
      specs.forEach(function (s) {
        html += '<tr><td class="aai-spec-label">' + escHtml(s[0]) + '</td><td class="aai-spec-value">' + escHtml(s[1]) + '</td></tr>';
      });
      html += '</table>';
    }

    // Images gallery
    if (v.images && v.images.length > 1) {
      html += '<div class="aai-gallery">';
      v.images.forEach(function (img) {
        if (img.url) {
          html += '<img src="' + escHtml(img.url) + '" alt="' + escHtml(img.perspective || "") + '" loading="lazy" class="aai-gallery-img" />';
        }
      });
      html += '</div>';
    }

    return html;
  }

  function escHtml(s) {
    if (!s) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getStyles(theme, cols) {
    var isDark = theme === "dark";
    var bg = isDark ? "#1a1a2e" : "#ffffff";
    var cardBg = isDark ? "#16213e" : "#ffffff";
    var text = isDark ? "#e0e0e0" : "#1a1a1a";
    var textMuted = isDark ? "#a0a0a0" : "#6b7280";
    var accent = "#2563eb";
    var border = isDark ? "#2a2a4a" : "#e5e7eb";

    return [
      ".aai-loading { text-align:center; padding:3rem; color:" + textMuted + "; }",
      ".aai-spinner { width:32px; height:32px; border:3px solid " + border + "; border-top-color:" + accent + "; border-radius:50%; animation:aai-spin 0.8s linear infinite; margin:0 auto 1rem; }",
      "@keyframes aai-spin { to { transform:rotate(360deg); } }",
      ".aai-empty, .aai-error { text-align:center; padding:2rem; color:" + textMuted + "; }",
      ".aai-error { color:#ef4444; }",
      ".aai-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(300px,1fr)); gap:1.5rem; }",
      "@media(min-width:1200px) { .aai-grid { grid-template-columns:repeat(" + cols + ",1fr); } }",
      ".aai-card { border:1px solid " + border + "; border-radius:12px; overflow:hidden; background:" + cardBg + "; transition:box-shadow 0.2s, transform 0.2s; }",
      ".aai-card:hover { box-shadow:0 8px 25px rgba(0,0,0,0.1); transform:translateY(-2px); }",
      ".aai-card-img { position:relative; overflow:hidden; }",
      ".aai-card-img img { width:100%; height:200px; object-fit:cover; display:block; }",
      ".aai-card-body { padding:1rem; }",
      ".aai-card-title { margin:0 0 0.25rem; font-size:1.1rem; font-weight:600; color:" + text + "; }",
      ".aai-card-meta { margin:0 0 0.5rem; font-size:0.8rem; color:" + textMuted + "; }",
      ".aai-card-price { margin:0; font-size:1.25rem; font-weight:700; color:" + accent + "; }",
      ".aai-card-rate { margin:0.25rem 0 0; font-size:0.85rem; color:" + textMuted + "; }",
      ".aai-single { max-width:800px; }",
      ".aai-detail-img { width:100%; border-radius:12px; margin-bottom:1.5rem; }",
      ".aai-detail-title { font-size:1.5rem; font-weight:700; color:" + text + "; margin:0 0 0.5rem; }",
      ".aai-detail-price { font-size:1.5rem; font-weight:700; color:" + accent + "; margin:0 0 1.5rem; }",
      ".aai-specs { width:100%; border-collapse:collapse; margin-bottom:1.5rem; }",
      ".aai-specs tr { border-bottom:1px solid " + border + "; }",
      ".aai-specs td { padding:0.5rem 0; }",
      ".aai-spec-label { color:" + textMuted + "; width:40%; }",
      ".aai-spec-value { color:" + text + "; font-weight:500; }",
      ".aai-gallery { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:0.5rem; }",
      ".aai-gallery-img { width:100%; height:120px; object-fit:cover; border-radius:8px; }",
    ].join("\n");
  }
})();
