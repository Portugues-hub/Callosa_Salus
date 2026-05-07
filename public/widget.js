(function () {
  var WIDGET_ID = "callosasalud-widget";
  var WIDGET_SRC = "https://callosa-salud.vercel.app/widget";

  function mountWidget() {
    var host = document.getElementById(WIDGET_ID);
    if (!host) return;
    if (host.dataset.callosaMounted === "true") return;

    host.dataset.callosaMounted = "true";
    host.style.width = "100%";

    var iframe = document.createElement("iframe");
    iframe.src = WIDGET_SRC;
    iframe.title = "Reservas CallosaSalud";
    iframe.loading = "lazy";
    iframe.referrerPolicy = "strict-origin-when-cross-origin";
    iframe.setAttribute("allow", "clipboard-write");

    iframe.style.width = "100%";
    iframe.style.minHeight = "820px";
    iframe.style.border = "0";
    iframe.style.borderRadius = "16px";
    iframe.style.display = "block";
    iframe.style.background = "#ffffff";
    iframe.style.boxShadow = "0 10px 30px rgba(15, 23, 42, 0.08)";

    host.appendChild(iframe);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mountWidget);
  } else {
    mountWidget();
  }
})();
