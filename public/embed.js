/**
 * Autohaus.AI Embed Script
 * Usage: <script src="https://your-domain/embed.js" data-api-key="ak_..."></script>
 * Place a <div id="autohaus-ai-vehicles"></div> where you want the vehicles to appear.
 */
(function () {
  var script = document.currentScript;
  var apiKey = script && script.getAttribute("data-api-key");
  var container = document.getElementById("autohaus-ai-vehicles");

  if (!apiKey || !container) {
    console.warn("[Autohaus.AI] Missing data-api-key or #autohaus-ai-vehicles container.");
    return;
  }

  var baseUrl = script.src.replace(/\/embed\.js.*$/, "");
  // Derive the Supabase functions URL from the script origin
  // The API endpoint should be configured or we use a known pattern
  var apiUrl = baseUrl.includes("localhost")
    ? "http://localhost:54321/functions/v1/api-vehicles"
    : baseUrl.replace(/\/embed\.js.*$/, "").replace(/^(https?:\/\/[^/]+).*$/, "$1") + "/functions/v1/api-vehicles";

  // For production, use the Supabase URL from the script's data attribute
  var supabaseUrl = script.getAttribute("data-supabase-url");
  if (supabaseUrl) {
    apiUrl = supabaseUrl + "/functions/v1/api-vehicles";
  }

  container.innerHTML = '<p style="text-align:center;padding:2em;color:#888;">Fahrzeuge werden geladen...</p>';

  fetch(apiUrl, { headers: { "x-api-key": apiKey } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.vehicles || data.vehicles.length === 0) {
        container.innerHTML = '<p style="text-align:center;padding:2em;color:#888;">Keine Fahrzeuge verfügbar.</p>';
        return;
      }

      var html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:1.5rem;">';
      data.vehicles.forEach(function (v) {
        var vd = v.vehicle_data || {};
        var vehicle = vd.vehicle || {};
        var title = v.title || (vehicle.brand + " " + vehicle.model) || "Fahrzeug";
        var price = vehicle.price || "";
        var imgUrl = v.main_image_url || "";

        html += '<div style="border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff;">';
        if (imgUrl) {
          html += '<img src="' + imgUrl + '" alt="' + title + '" style="width:100%;height:200px;object-fit:cover;" />';
        }
        html += '<div style="padding:1rem;">';
        html += '<h3 style="margin:0 0 0.5rem;font-size:1.1rem;font-weight:600;">' + title + '</h3>';
        if (price) html += '<p style="margin:0;font-size:1.25rem;font-weight:700;color:#2563eb;">' + price + '</p>';
        html += '</div></div>';
      });
      html += '</div>';
      container.innerHTML = html;
    })
    .catch(function () {
      container.innerHTML = '<p style="text-align:center;padding:2em;color:#ef4444;">Fehler beim Laden der Fahrzeuge.</p>';
    });
})();
