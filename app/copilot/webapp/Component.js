sap.ui.define([
  "sap/ui/core/Component"
], function (Component) {
  "use strict";

  /**
   * FLP Shell Plugin: Launchpad seviyesinde, erişim-farkında copilot.
   *
   * Bu Component, launchpad'in plugin konfigürasyonuna eklenince HER açılışta
   * yüklenir (ayrı bir uygulama DEĞİL). init() içinde:
   *   1) Renderer'a bir başlık (header) butonu ekler → copilot panelini açar.
   *   2) SearchableContent ile kullanıcının erişebildiği app'leri (katalog) çeker
   *      — Spaces & Pages ya da klasik group fark etmez, içerik modelinden bağımsız.
   *   3) Kullanıcı mesajını + kataloğu CAP /copilot/route servisine yollar,
   *      dönen intent'e göre Navigation servisiyle doğru app'e yönlendirir.
   */
  return Component.extend("borusan.copilot.Component", {

    metadata: { manifest: "json" },

    init: function () {
      Component.prototype.init.apply(this, arguments);
      this._catalog = [];

      // CAP servis kökü; gerçek ortamda destination üzerinden gelir.
      this._serviceUrl = (this.getManifestEntry("/sap.copilot/serviceUrl")) || "/copilot";

      sap.ushell.Container.getServiceAsync("Renderer")
        .then(this._addHeaderButton.bind(this))
        .catch(function (e) { jQuery.sap.log.error("Copilot: Renderer alınamadı", e); });

      this._loadCatalog();
    },

    /** Başlık çubuğuna copilot'u açan buton ekler. */
    _addHeaderButton: function (oRenderer) {
      oRenderer.addHeaderEndItem({
        id: "copilotShellButton",
        icon: "sap-icon://discussion",
        tooltip: "Copilot",
        showSeparator: false,
        press: this._togglePanel.bind(this)
      }, true, false);
    },

    /** Kullanıcının erişebildiği uygulamaları enumerate eder → katalog. */
    _loadCatalog: function () {
      var that = this;
      sap.ushell.Container.getServiceAsync("SearchableContent")
        .then(function (oSC) { return oSC.getApps(); })
        .then(function (aApps) {
          // Her app: { text, label, icon, visualizations:[{ targetURL:"#SO-action", ... }] }
          that._catalog = (aApps || []).map(function (app) {
            var viz = (app.visualizations && app.visualizations[0]) || {};
            var hash = (viz.targetURL || "").replace(/^#/, "");      // "SO-action"
            var parts = hash.split("-");
            return {
              id: hash || app.text,
              title: app.text || app.label,
              subtitle: viz.subtitle || "",
              semanticObject: parts[0] || "",
              action: parts[1] || "",
              keywords: (app.keywords || [])
            };
          }).filter(function (a) { return a.id; });
          jQuery.sap.log.info("Copilot: " + that._catalog.length + " uygulama yüklendi.");
        })
        .catch(function (e) { jQuery.sap.log.error("Copilot: katalog yüklenemedi", e); });
    },

    /** Copilot panelini (popover) aç/kapat. */
    _togglePanel: function (oEvent) {
      var that = this;
      if (this._oPopover && this._oPopover.isOpen()) { this._oPopover.close(); return; }

      sap.ui.require([
        "sap/m/ResponsivePopover", "sap/m/VBox", "sap/m/Input",
        "sap/m/Button", "sap/m/MessageStrip", "sap/m/Bar", "sap/m/Title"
      ], function (Popover, VBox, Input, Button, MessageStrip, Bar, Title) {
        if (!that._oPopover) {
          that._oLog = new VBox({ width: "100%" });
          that._oInput = new Input({
            width: "100%",
            placeholder: "Ne yapmak istiyorsun? (ör: satınalma siparişlerini aç)",
            submit: function (e) { that._ask(e.getParameter("value")); e.getSource().setValue(""); }
          });
          that._oPopover = new Popover({
            placement: "Bottom",
            contentWidth: "360px",
            customHeader: new Bar({ contentMiddle: [new Title({ text: "Copilot" })] }),
            content: [that._oLog],
            footer: new Bar({ contentRight: [
              new Button({
                text: "Gönder", type: "Emphasized",
                press: function () { that._ask(that._oInput.getValue()); that._oInput.setValue(""); }
              })
            ]}),
            beginButton: that._oInput
          });
          // Input'u içeriğin altına koy.
          that._oPopover.addContent(that._oInput);
        }
        that._oPopover.openBy(oEvent.getSource());
      });
    },

    /** Mesajı CAP'e yollar, intent'e göre davranır. */
    _ask: function (sMessage) {
      if (!sMessage || !sMessage.trim()) { return; }
      var that = this;
      this._appendMessage("Sen: " + sMessage, "Information");

      jQuery.ajax({
        url: this._serviceUrl + "/route",
        method: "POST",
        contentType: "application/json",
        data: JSON.stringify({ message: sMessage, catalog: this._catalog })
      }).done(function (res) {
        // OData v4 action sonucu doğrudan obje döner.
        var intent = res && (res.value || res);
        that._handleIntent(intent);
      }).fail(function (xhr) {
        that._appendMessage("Copilot: Bir hata oluştu (" + xhr.status + ").", "Error");
      });
    },

    _handleIntent: function (intent) {
      if (!intent) { return; }
      var msg = intent.message || "";

      switch (intent.intent) {
        case "navigate":
          this._appendMessage("Copilot: " + msg, "Success");
          this._navigate(intent.appIds && intent.appIds[0]);
          break;
        case "clarify":
          this._appendMessage("Copilot: " + (intent.followup || msg), "Warning");
          break;
        case "no_access":
          this._appendMessage("Copilot: " + msg, "Warning");
          break;
        default: // answer
          this._appendMessage("Copilot: " + msg, "Information");
      }
    },

    /** Navigation servisiyle hedef app'e geçer. */
    _navigate: function (sAppId) {
      if (!sAppId) { return; }
      var parts = sAppId.split("-");
      sap.ushell.Container.getServiceAsync("Navigation").then(function (oNav) {
        oNav.navigate({ target: { semanticObject: parts[0], action: parts[1] } });
      });
    },

    _appendMessage: function (sText, sType) {
      var that = this;
      sap.ui.require(["sap/m/MessageStrip"], function (MessageStrip) {
        that._oLog.addItem(new MessageStrip({
          text: sText, type: sType || "Information", showIcon: true,
          class: "sapUiTinyMarginBottom"
        }));
      });
    },

    exit: function () {
      if (this._oPopover) { this._oPopover.destroy(); }
    }
  });
});
