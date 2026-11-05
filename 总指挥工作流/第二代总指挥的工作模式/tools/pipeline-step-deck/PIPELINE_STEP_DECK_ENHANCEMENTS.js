(function () {
  "use strict";

  const VERSION = "2.0.1";
  const CONTROL_ATTRIBUTE = "data-deck-control";
  const STYLE_ID = "pipeline-step-deck-enhancement-style";

  const STYLE = `
    .deck-column-heading,
    .deck-card-heading {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .deck-column-title,
    .deck-card-title {
      flex: 1 1 auto;
      min-width: 0;
    }

    .deck-utility-button {
      flex: 0 0 auto;
      min-width: 44px;
      min-height: 22px;
      padding: 2px 7px;
      border: 1px solid #9dbfba;
      border-radius: 7px;
      background: #fff;
      color: #086a61;
      font: 700 11px/1.25 system-ui, sans-serif;
      cursor: pointer;
    }

    .deck-utility-button:hover { background: #e8f6f3; }
    .deck-utility-button:disabled { cursor: wait; opacity: .72; }
    .deck-utility-button:focus-visible { outline: 2px solid #0a8c7e; outline-offset: 2px; }
    .deck-export-button { min-width: 66px; white-space: nowrap; }

    .deck-copyable-output {
      position: relative;
      width: 100%;
      min-height: 0;
    }

    .deck-copyable-output > .deck-copy-button {
      position: absolute;
      top: 7px;
      right: 7px;
      z-index: 2;
      border-color: rgba(255,255,255,.5);
      background: rgba(21,33,39,.88);
      color: #fff;
    }

    .deck-copyable-output > .deck-copy-button:hover { background: #23363e; }

    .deck-key-parameter-label,
    .deck-comparison-identity-label {
      display: block;
      margin-top: 3px;
      color: #4f6970;
      font: 600 11px/1.35 system-ui, sans-serif;
    }

    .deck-comparison-identity-label { color: #5d747a; }

    .deck-card-heading > .deck-copy-button {
      position: static;
      min-width: 40px;
      min-height: 22px;
      padding: 2px 6px;
    }

    .deck-identical-artifact-summary {
      margin: 0;
      padding: 7px 10px;
      border-top: 1px solid #c9d9dc;
      background: #f4f8f8;
      color: #47646b;
      font: 12px/1.45 system-ui, sans-serif;
    }

    .deck-identical-artifact-toggle {
      display: block;
      margin-top: 5px;
      padding: 0;
      border: 0;
      background: transparent;
      color: #08776c;
      font: 700 11px/1.4 system-ui, sans-serif;
      cursor: pointer;
    }

    .comparison-card[hidden] { display: none !important; }
  `;

  function installStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLE;
    document.head.appendChild(style);
  }

  function makeButton(label, title, className) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = ("deck-utility-button " + (className || "")).trim();
    button.textContent = label;
    button.title = title;
    button.setAttribute(CONTROL_ATTRIBUTE, "true");
    return button;
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // 浏览器拒绝 Clipboard API 时继续尝试兼容路径。
      }
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-100000px";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("浏览器拒绝了剪贴板写入");
  }

  function textFromNode(node) {
    if (node.matches("table")) {
      return Array.from(node.rows).map((row) =>
        Array.from(row.cells).map((cell) => String(cell.textContent || "").trim()).join("\t")
      ).join("\n");
    }
    return String(node.textContent || "");
  }

  function nullableText(value) {
    if (value === undefined || value === null) return null;
    const text = String(value).trim();
    return text || null;
  }

  function normalizeAttributes(value) {
    if (Array.isArray(value)) {
      return value.map((item, index) => {
        if (item && typeof item === "object") {
          return {
            name: nullableText(item.name || item.key || item.label) || `attribute-${index + 1}`,
            value: item.value === undefined ? null : item.value
          };
        }
        return { name: `attribute-${index + 1}`, value: item };
      });
    }
    if (value && typeof value === "object") {
      return Object.entries(value).map(([name, attributeValue]) => ({ name, value: attributeValue }));
    }
    return [];
  }

  function parseLegacyColumnIdentity(title) {
    const parts = String(title || "").split(/\s*[｜|]\s*/).map((part) => part.trim()).filter(Boolean);
    if (!parts.length) return null;
    const attributes = parts.slice(1).map((part, index) => {
      const explicit = part.match(/^(.+?)\s*[=:]\s*(.+)$/);
      if (explicit) return { name: explicit[1].trim(), value: explicit[2].trim() };
      const parenthesized = part.match(/^(.+?)\s*(\([^)]*\))$/);
      if (parenthesized) return { name: parenthesized[1].trim(), value: parenthesized[2].trim() };
      return { name: `attribute-${index + 1}`, value: part };
    });
    return { label: parts[0], attributes, provenance: "legacy-column-label" };
  }

  function comparisonIdentityFor(column) {
    if (!column) return null;
    const data = column.__pipelineColumn || {};
    const explicit = data.comparisonIdentity;
    if (typeof explicit === "string") {
      return { label: nullableText(explicit), attributes: [], provenance: "declared" };
    }
    if (explicit && typeof explicit === "object") {
      return {
        label: nullableText(explicit.label || explicit.name || explicit.role),
        attributes: normalizeAttributes(explicit.attributes || explicit.parameters || explicit.metadata),
        provenance: "declared"
      };
    }
    return parseLegacyColumnIdentity(textWithoutControls(column.querySelector(":scope > h3")));
  }

  function nodeDescriptionFor(step) {
    const data = step || {};
    const renderedFacts = Array.from(document.querySelectorAll("#factList .fact dd"))
      .map((element) => nullableText(element.textContent));
    return {
      input: nullableText(data.input) || renderedFacts[0] || null,
      processing: nullableText(data.process || data.processing) || renderedFacts[1] || null,
      output: nullableText(data.output) || renderedFacts[2] || null,
      invariants: nullableText(data.invariant || data.invariants) || renderedFacts[3] || null,
      failureSignals: nullableText(data.failureSignal || data.failureSignals) || renderedFacts[4] || null,
      relationToCurrentIssue: nullableText(data.relation || data.relationToCurrentIssue) || renderedFacts[5] || null
    };
  }

  function visualLegendFor(step) {
    const legend = step && step.visualLegend;
    if (!legend) return null;
    if (Array.isArray(legend)) {
      const normalized = legend.map((item, index) => {
        if (item && typeof item === "object") {
          return {
            symbol: nullableText(item.symbol || item.key || item.label) || `legend-${index + 1}`,
            meaning: nullableText(item.meaning || item.value || item.description)
          };
        }
        return { symbol: `legend-${index + 1}`, meaning: nullableText(item) };
      }).filter((item) => item.meaning);
      return normalized.length ? normalized : null;
    }
    if (typeof legend === "object") return Object.keys(legend).length ? legend : null;
    return nullableText(legend);
  }

  function evidenceIdentityFor(entry) {
    if (!entry || typeof entry !== "object") return null;
    const identity = {
      executionIdentity: entry.executionIdentity === undefined ? null : entry.executionIdentity,
      artifactIdentity: entry.artifactIdentity === undefined ? null : entry.artifactIdentity,
      comparisonKey: nullableText(entry.comparisonKey),
      keyParameters: entry.keyParameters === undefined ? null : entry.keyParameters,
      changeSet: entry.changeSet === undefined ? null : entry.changeSet
    };
    return Object.values(identity).some((value) => value !== null) ? identity : null;
  }

  function contentHeadingText(heading) {
    if (!heading) return "";
    const clone = heading.cloneNode(true);
    clone.querySelectorAll(
      `[${CONTROL_ATTRIBUTE}], .deck-key-parameter-label, .deck-comparison-identity-label`
    ).forEach((element) => element.remove());
    return String(clone.textContent || "").trim();
  }

  function makeStructuredCopyText(node) {
    const stage = node.closest("#evidenceStage");
    const step = (stage && stage.__pipelineStep) || {};
    const column = node.closest(".comparison-column");
    const card = node.closest(".comparison-card");
    const columnLabel = column ? textWithoutControls(column.querySelector(":scope > h3")) : null;
    const contentTitle = card
      ? contentHeadingText(card.querySelector(":scope > h4"))
      : nullableText((step.stageOutput || {}).title) || "结构化运行证据";
    const comparisonContext = {
      presentation: nullableText((document.getElementById("deckTitle") || {}).textContent),
      node: {
        id: step.id === undefined ? nullableText((document.getElementById("stepNumber") || {}).textContent) : String(step.id),
        title: nullableText(step.title || step.name || (document.getElementById("stepName") || {}).textContent)
      },
      comparisonIdentity: comparisonIdentityFor(column),
      columnLabel,
      contentTitle,
      evidenceIdentity: evidenceIdentityFor(card && card.__pipelineEntry)
    };
    const sections = [
      "[comparison-context]",
      JSON.stringify(comparisonContext, null, 2),
      "[/comparison-context]",
      "",
      "[node-description]",
      JSON.stringify(nodeDescriptionFor(step), null, 2),
      "[/node-description]"
    ];
    const legend = visualLegendFor(step);
    if (legend) sections.push("", "[visual-legend]", JSON.stringify(legend, null, 2), "[/visual-legend]");
    sections.push("", "[content]", textFromNode(node), "[/content]");
    return sections.join("\n");
  }

  function formatIdentity(identity) {
    if (!identity) return "";
    const parts = [];
    if (identity.label) parts.push(identity.label);
    normalizeAttributes(identity.attributes).forEach((item) => {
      parts.push(`${item.name}=${item.value === null ? "未提供" : String(item.value)}`);
    });
    return parts.join("；");
  }

  function formatKeyParameters(value) {
    return normalizeAttributes(value).map((item) =>
      `${item.name}=${item.value === null ? "未提供" : String(item.value)}`
    ).join("；");
  }

  function makeCopyButton(textProvider) {
    const button = makeButton("复制", "一键复制完整文本", "deck-copy-button");
    button.addEventListener("click", async () => {
      const original = "复制";
      button.disabled = true;
      try {
        const text = String(textProvider() || "");
        await copyText(text);
        button.textContent = "已复制";
        button.dataset.state = "success";
        button.dataset.lastCopyLength = String(text.length);
      } catch (error) {
        console.error("复制失败", error);
        button.textContent = "复制失败";
        button.dataset.state = "error";
      } finally {
        window.setTimeout(() => {
          button.textContent = original;
          button.disabled = false;
          delete button.dataset.state;
        }, 1600);
      }
    });
    return button;
  }

  function wrapHeadingText(heading, className) {
    const existing = heading.querySelector(":scope > ." + className);
    if (existing) return existing;
    const span = document.createElement("span");
    span.className = className;
    Array.from(heading.childNodes).forEach((node) => {
      if (!(node.nodeType === Node.ELEMENT_NODE && node.hasAttribute && node.hasAttribute(CONTROL_ATTRIBUTE))) {
        span.appendChild(node);
      }
    });
    heading.prepend(span);
    return span;
  }

  function enhanceCopyNode(node) {
    if (node.dataset.deckCopyEnhanced === VERSION) return;
    node.dataset.deckCopyEnhanced = VERSION;
    const card = node.closest(".comparison-card");
    const button = makeCopyButton(() => makeStructuredCopyText(node));
    if (card) {
      const heading = card.querySelector(":scope > h4");
      if (!heading) return;
      heading.classList.add("deck-card-heading");
      const title = wrapHeadingText(heading, "deck-card-title");
      const identityText = formatIdentity(comparisonIdentityFor(card.closest(".comparison-column")));
      if (identityText && !title.querySelector(".deck-comparison-identity-label")) {
        const label = document.createElement("span");
        label.className = "deck-comparison-identity-label";
        label.textContent = `对照身份：${identityText}`;
        title.appendChild(label);
      }
      heading.appendChild(button);
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.className = "deck-copyable-output";
    node.before(wrapper);
    wrapper.append(node, button);
  }

  function safeFileName(value) {
    return String(value || "阶段输出")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 96) || "阶段输出";
  }

  function artifactIdentityFor(entry) {
    const artifact = entry && entry.artifactIdentity;
    if (!artifact || typeof artifact !== "object") return null;
    const sha256 = nullableText(artifact.sha256 || artifact.sha || artifact.hash);
    const stage = nullableText(artifact.stage);
    const role = nullableText(artifact.role);
    const kind = nullableText(artifact.kind || artifact.type);
    if (!sha256 || !/^[a-f0-9]{64}$/i.test(sha256) || !stage || !role || !kind) return null;
    return { sha256: sha256.toLowerCase(), stage, role, kind };
  }

  function executionIdentityLabel(entry, index) {
    const identity = entry && entry.executionIdentity;
    if (typeof identity === "string" && identity.trim()) return identity.trim();
    if (identity && typeof identity === "object") return JSON.stringify(identity);
    const parameters = formatKeyParameters(entry && entry.keyParameters);
    return parameters || `执行记录 ${index + 1}`;
  }

  function enhanceCardMetadata(card) {
    if (card.dataset.deckMetadataEnhanced === VERSION) return;
    card.dataset.deckMetadataEnhanced = VERSION;
    const entry = card.__pipelineEntry;
    if (!entry || typeof entry !== "object") return;
    const parameters = formatKeyParameters(entry.keyParameters);
    if (!parameters) return;
    const heading = card.querySelector(":scope > h4");
    if (!heading) return;
    const title = wrapHeadingText(heading, "deck-card-title");
    if (title.querySelector(".deck-key-parameter-label")) return;
    const label = document.createElement("span");
    label.className = "deck-key-parameter-label";
    label.textContent = `关键参数：${parameters}`;
    title.appendChild(label);
  }

  function applyExactArtifactDedupe(column) {
    if (column.dataset.deckArtifactDedupeEnhanced === VERSION) return;
    column.dataset.deckArtifactDedupeEnhanced = VERSION;
    const cards = Array.from(column.querySelectorAll(":scope > .comparison-items > .comparison-card"));
    const diagnosticMode = column.closest(".comparison-output")?.dataset.viewMode === "diagnostic-comparison";
    const groups = new Map();
    cards.forEach((card, index) => {
      const identity = artifactIdentityFor(card.__pipelineEntry);
      if (!identity || !card.querySelector(".comparison-card-output img")) return;
      const comparisonKey = diagnosticMode ? nullableText(card.__pipelineEntry && card.__pipelineEntry.comparisonKey) : null;
      const key = JSON.stringify([identity.stage, identity.role, identity.kind, identity.sha256, comparisonKey || ""]);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ card, index });
    });
    let folded = false;
    groups.forEach((records) => {
      if (records.length < 2) return;
      folded = true;
      const keeper = records[0].card;
      const hiddenCards = records.slice(1).map((record) => record.card);
      hiddenCards.forEach((card) => { card.hidden = true; });
      const summary = document.createElement("p");
      summary.className = "deck-identical-artifact-summary";
      summary.setAttribute(CONTROL_ATTRIBUTE, "true");
      const origins = records.map((record) => executionIdentityLabel(record.card.__pipelineEntry, record.index));
      summary.append(`该阶段内 SHA-256 完全相同的产物同时来自：${origins.join(" / ")}`);
      const toggle = makeButton(`展开 ${hiddenCards.length} 条同产物记录`, "展开或收起视觉相同但执行身份不同的完整记录", "deck-identical-artifact-toggle");
      toggle.addEventListener("click", () => {
        const shouldShow = hiddenCards.some((card) => card.hidden);
        hiddenCards.forEach((card) => { card.hidden = !shouldShow; });
        toggle.textContent = shouldShow
          ? `收起 ${hiddenCards.length} 条同产物记录`
          : `展开 ${hiddenCards.length} 条同产物记录`;
        window.dispatchEvent(new Event("resize"));
      });
      summary.appendChild(toggle);
      keeper.appendChild(summary);
    });
    if (folded) window.dispatchEvent(new Event("resize"));
  }

  function canvasToPngBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("长图编码失败"));
      }, "image/png");
    });
  }

  function drawRoundedRect(context, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    context.beginPath();
    context.moveTo(x + r, y);
    context.lineTo(x + width - r, y);
    context.quadraticCurveTo(x + width, y, x + width, y + r);
    context.lineTo(x + width, y + height - r);
    context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
    context.lineTo(x + r, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - r);
    context.lineTo(x, y + r);
    context.quadraticCurveTo(x, y, x + r, y);
    context.closePath();
  }

  function wrapText(context, value, maximumWidth, maximumLines) {
    const lines = [];
    const limit = Number.isFinite(maximumLines) ? maximumLines : Infinity;
    const paragraphs = String(value || "").replace(/\r/g, "").split("\n");
    let truncated = false;
    for (const paragraph of paragraphs) {
      if (lines.length >= limit) {
        truncated = true;
        break;
      }
      if (!paragraph) {
        lines.push("");
        continue;
      }
      let line = "";
      for (const character of paragraph) {
        const candidate = line + character;
        if (line && context.measureText(candidate).width > maximumWidth) {
          lines.push(line);
          line = character;
          if (lines.length >= limit) {
            truncated = true;
            break;
          }
        } else {
          line = candidate;
        }
      }
      if (lines.length >= limit) break;
      if (line) lines.push(line);
    }
    if (truncated && lines.length) lines[lines.length - 1] += "…";
    return { lines, truncated };
  }

  function textWithoutControls(element) {
    if (!element) return "";
    const clone = element.cloneNode(true);
    clone.querySelectorAll("[" + CONTROL_ATTRIBUTE + "]").forEach((control) => control.remove());
    return String(clone.textContent || "").trim();
  }

  function waitForImage(image) {
    image.loading = "eager";
    if (image.complete) {
      return image.naturalWidth > 0
        ? Promise.resolve(image)
        : Promise.reject(new Error("页面图片没有可导出的像素"));
    }
    return new Promise((resolve, reject) => {
      image.addEventListener("load", () => resolve(image), { once: true });
      image.addEventListener("error", () => reject(new Error("页面图片加载失败")), { once: true });
    });
  }

  async function collectCards(column) {
    const cards = Array.from(column.querySelectorAll(".comparison-card"));
    if (!cards.length) {
      const placeholder = column.querySelector(".comparison-items > .placeholder");
      return [{
        title: "本次路径未执行该节点",
        caption: "",
        kind: "placeholder",
        text: textWithoutControls(placeholder)
      }];
    }
    return Promise.all(cards.map(async (card) => {
      const output = card.querySelector(".comparison-card-output");
      const image = output && output.querySelector("img");
      const code = output && output.querySelector("pre.evidence-code");
      const table = output && output.querySelector("table");
      const placeholder = output && output.querySelector(".placeholder");
      const model = {
        title: textWithoutControls(card.querySelector(":scope > h4")),
        caption: String((card.querySelector(":scope > .comparison-item-caption") || {}).textContent || "").trim(),
        kind: "text",
        text: ""
      };
      if (image) {
        try {
          model.kind = "image";
          model.image = await waitForImage(image);
        } catch (error) {
          model.kind = "placeholder";
          model.text = error.message;
        }
      } else if (code) {
        model.kind = "code";
        model.text = String(code.textContent || "");
      } else if (table) {
        model.kind = "table";
        model.text = textFromNode(table);
      } else if (placeholder) {
        model.kind = "placeholder";
        model.text = textWithoutControls(placeholder);
      } else {
        model.text = textWithoutControls(output);
      }
      return model;
    }));
  }

  function makeCardLayout(context, model, cardWidth) {
    const innerWidth = cardWidth - 24;
    context.font = '700 14px "Segoe UI","Microsoft YaHei",sans-serif';
    const title = wrapText(context, model.title, innerWidth, 4);
    const titleHeight = Math.max(40, 16 + title.lines.length * 20);
    let bodyHeight = 0;
    let bodyLines = [];
    let bodyTruncated = false;
    if (model.kind === "image") {
      const ratioHeight = innerWidth * model.image.naturalHeight / model.image.naturalWidth;
      bodyHeight = Math.max(100, Math.min(260, ratioHeight));
    } else {
      context.font = model.kind === "code" || model.kind === "table"
        ? '12px Consolas,"Microsoft YaHei",monospace'
        : '13px "Segoe UI","Microsoft YaHei",sans-serif';
      const wrapped = wrapText(context, model.text, innerWidth - 20, model.kind === "placeholder" ? 8 : 18);
      bodyLines = wrapped.lines;
      bodyTruncated = wrapped.truncated;
      bodyHeight = Math.max(76, 22 + bodyLines.length * 18 + (bodyTruncated ? 26 : 0));
    }
    context.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
    const caption = model.caption ? wrapText(context, model.caption, innerWidth, 6) : { lines: [] };
    const captionHeight = caption.lines.length ? 12 + caption.lines.length * 18 : 0;
    return {
      model,
      titleLines: title.lines,
      titleHeight,
      bodyLines,
      bodyTruncated,
      bodyHeight,
      captionLines: caption.lines,
      captionHeight,
      height: titleHeight + bodyHeight + captionHeight
    };
  }

  function drawCard(context, layout, x, y, width) {
    drawRoundedRect(context, x, y, width, layout.height, 10);
    context.fillStyle = "#fff";
    context.fill();
    context.strokeStyle = "#c9d6da";
    context.lineWidth = 1;
    context.stroke();
    context.fillStyle = "#15242b";
    context.font = '700 14px "Segoe UI","Microsoft YaHei",sans-serif';
    layout.titleLines.forEach((line, index) => context.fillText(line, x + 12, y + 18 + index * 20));
    const bodyY = y + layout.titleHeight;
    context.strokeStyle = "#c9d6da";
    context.beginPath();
    context.moveTo(x, bodyY + .5);
    context.lineTo(x + width, bodyY + .5);
    context.stroke();
    if (layout.model.kind === "image") {
      context.fillStyle = "#f2f6f6";
      context.fillRect(x + 1, bodyY + 1, width - 2, layout.bodyHeight - 1);
      const availableWidth = width - 24;
      const scale = Math.min(
        availableWidth / layout.model.image.naturalWidth,
        layout.bodyHeight / layout.model.image.naturalHeight
      );
      const drawWidth = layout.model.image.naturalWidth * scale;
      const drawHeight = layout.model.image.naturalHeight * scale;
      context.drawImage(
        layout.model.image,
        x + (width - drawWidth) / 2,
        bodyY + (layout.bodyHeight - drawHeight) / 2,
        drawWidth,
        drawHeight
      );
    } else {
      const structured = layout.model.kind === "code" || layout.model.kind === "table";
      context.fillStyle = structured ? "#15242b" : "#f2f6f6";
      context.fillRect(x + 1, bodyY + 1, width - 2, layout.bodyHeight - 1);
      context.fillStyle = structured ? "#f3f8f7" : "#4f646d";
      context.font = structured
        ? '12px Consolas,"Microsoft YaHei",monospace'
        : '13px "Segoe UI","Microsoft YaHei",sans-serif';
      layout.bodyLines.forEach((line, index) => context.fillText(line, x + 12, bodyY + 20 + index * 18));
      if (layout.bodyTruncated) {
        context.fillStyle = structured ? "#8de0d2" : "#087a6f";
        context.font = '700 11px "Segoe UI","Microsoft YaHei",sans-serif';
        context.fillText("完整文本请使用页面上的“复制”按钮", x + 12, bodyY + layout.bodyHeight - 10);
      }
    }
    if (layout.captionLines.length) {
      const captionY = bodyY + layout.bodyHeight;
      context.strokeStyle = "#c9d6da";
      context.beginPath();
      context.moveTo(x, captionY + .5);
      context.lineTo(x + width, captionY + .5);
      context.stroke();
      context.fillStyle = "#637780";
      context.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
      layout.captionLines.forEach((line, index) => context.fillText(line, x + 12, captionY + 17 + index * 18));
    }
  }

  async function renderColumn(column) {
    await document.fonts.ready;
    const models = await collectCards(column);
    const naturalWidth = 420;
    const cardWidth = naturalWidth - 24;
    const measureCanvas = document.createElement("canvas");
    const measureContext = measureCanvas.getContext("2d");
    if (!measureContext) throw new Error("浏览器未提供文字测量画布");
    const layouts = models.map((model) => makeCardLayout(measureContext, model, cardWidth));
    measureContext.font = '700 18px "Segoe UI","Microsoft YaHei",sans-serif';
    const title = textWithoutControls(column.querySelector(":scope > h3"));
    const heading = wrapText(measureContext, title, naturalWidth - 24, 3);
    const step = (column.closest("#evidenceStage") || {}).__pipelineStep || {};
    const legend = visualLegendFor(step);
    const legendText = legend
      ? (Array.isArray(legend)
        ? legend.map((item) => `${item.symbol}=${item.meaning}`).join("；")
        : (typeof legend === "object"
          ? Object.entries(legend).map(([symbol, meaning]) => `${symbol}=${meaning}`).join("；")
          : String(legend)))
      : "";
    measureContext.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
    const legendLines = legendText ? wrapText(measureContext, `图例：${legendText}`, naturalWidth - 24, 6).lines : [];
    const headingHeight = Math.max(54, 20 + heading.lines.length * 24 + (legendLines.length ? 10 + legendLines.length * 18 : 0));
    const naturalHeight = Math.ceil(headingHeight + 12 + layouts.reduce((sum, layout) => sum + layout.height + 12, 0));
    const maximumDimension = 30000;
    const maximumPixels = 64000000;
    const scale = Math.min(
      1.5,
      maximumDimension / naturalWidth,
      maximumDimension / naturalHeight,
      Math.sqrt(maximumPixels / (naturalWidth * naturalHeight))
    );
    const outputWidth = Math.max(1, Math.floor(naturalWidth * scale));
    const outputHeight = Math.max(1, Math.floor(naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("浏览器未提供 2D 画布");
    context.scale(scale, scale);
    context.fillStyle = "#f8fafb";
    context.fillRect(0, 0, naturalWidth, naturalHeight);
    context.fillStyle = "#e5f2ef";
    context.fillRect(0, 0, naturalWidth, headingHeight);
    context.fillStyle = "#153039";
    context.font = '700 18px "Segoe UI","Microsoft YaHei",sans-serif';
    heading.lines.forEach((line, index) => context.fillText(line, 12, 26 + index * 24));
    if (legendLines.length) {
      context.fillStyle = "#47646b";
      context.font = '12px "Segoe UI","Microsoft YaHei",sans-serif';
      const legendY = 30 + heading.lines.length * 24;
      legendLines.forEach((line, index) => context.fillText(line, 12, legendY + index * 18));
    }
    let y = headingHeight + 12;
    layouts.forEach((layout) => {
      drawCard(context, layout, 12, y, cardWidth);
      y += layout.height + 12;
    });
    return {
      blob: await canvasToPngBlob(canvas),
      width: outputWidth,
      height: outputHeight,
      scale,
      cardCount: models.length
    };
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function requestPngSaveHandle(fileName) {
    if (typeof window.showSaveFilePicker !== "function") return null;
    const options = {
      id: "pipeline-step-deck-long-image",
      suggestedName: fileName,
      startIn: "downloads",
      types: [{ description: "PNG 图像", accept: { "image/png": [".png"] } }]
    };
    try {
      return await window.showSaveFilePicker(options);
    } catch (error) {
      if (error && error.name === "AbortError") throw error;
      const fallbackOptions = { ...options };
      delete fallbackOptions.startIn;
      return window.showSaveFilePicker(fallbackOptions);
    }
  }

  async function saveBlob(blob, fileName, handle) {
    if (!handle) {
      downloadBlob(blob, fileName);
      return "browser-download";
    }
    const writable = await handle.createWritable();
    try {
      await writable.write(blob);
      await writable.close();
    } catch (error) {
      if (typeof writable.abort === "function") {
        try { await writable.abort(); } catch { /* 原错误优先。 */ }
      }
      throw error;
    }
    return "save-file-picker";
  }

  async function exportColumn(column, button) {
    const original = "导出长图";
    button.disabled = true;
    button.textContent = "生成中…";
    try {
      const stepNumber = String((document.getElementById("stepNumber") || {}).textContent || "步骤").trim();
      const title = textWithoutControls(column.querySelector(":scope > h3"));
      const fileName = safeFileName(stepNumber + "-" + title + "-长图.png");
      const handle = await requestPngSaveHandle(fileName);
      const result = await renderColumn(column);
      const saveMode = await saveBlob(result.blob, fileName, handle);
      button.textContent = "已导出";
      button.dataset.state = "success";
      button.dataset.lastExport = JSON.stringify({
        width: result.width,
        height: result.height,
        scale: result.scale,
        cardCount: result.cardCount,
        saveMode
      });
    } catch (error) {
      if (error && error.name === "AbortError") {
        button.textContent = "已取消";
        button.dataset.state = "cancelled";
      } else {
        console.error("长图导出失败", error);
        button.textContent = "导出失败";
        button.dataset.state = "error";
      }
    } finally {
      window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
        delete button.dataset.state;
      }, 1800);
    }
  }

  function enhanceColumn(column) {
    if (column.dataset.deckExportEnhanced === VERSION) return;
    const heading = column.querySelector(":scope > h3");
    if (!heading) return;
    column.dataset.deckExportEnhanced = VERSION;
    heading.classList.add("deck-column-heading");
    wrapHeadingText(heading, "deck-column-title");
    const button = makeButton("导出长图", "一键导出本栏全部阶段卡片", "deck-export-button");
    button.addEventListener("click", () => exportColumn(column, button));
    heading.appendChild(button);
    column.querySelectorAll(":scope > .comparison-items > .comparison-card").forEach(enhanceCardMetadata);
    applyExactArtifactDedupe(column);
  }

  function legacyStepIdFromChip(chip, fallbackPosition) {
    if (!chip) return String(fallbackPosition);
    const declared = String(chip.dataset.stepId || "").trim();
    if (declared) return declared;
    const visibleText = String(chip.textContent || "").trim();
    const firstToken = visibleText.match(/^\S+/);
    return firstToken ? firstToken[0] : String(fallbackPosition);
  }

  function synchronizeProgressCounter() {
    const counter = document.getElementById("stepCounter");
    const nav = document.getElementById("stageNav");
    if (!counter || !nav) return;
    const chips = Array.from(nav.querySelectorAll(".stage-chip"));
    if (!chips.length) return;
    const active = nav.querySelector('.stage-chip[aria-current="step"]') || chips[0];
    const activeIndex = Math.max(0, chips.indexOf(active));
    const visibleStepId = String((document.getElementById("stepNumber") || {}).textContent || "").trim();
    const currentId = visibleStepId || legacyStepIdFromChip(active, activeIndex + 1);
    const finalId = legacyStepIdFromChip(chips[chips.length - 1], chips.length);
    counter.textContent = `${currentId} / ${finalId}`;
  }

  function enhance() {
    installStyle();
    synchronizeProgressCounter();
    document.querySelectorAll("#evidenceStage pre.evidence-code, #evidenceStage table.evidence-table")
      .forEach(enhanceCopyNode);
    document.querySelectorAll("#evidenceStage .comparison-column").forEach(enhanceColumn);
  }

  function start() {
    enhance();
    const stage = document.getElementById("evidenceStage");
    if (!stage) return;
    const observer = new MutationObserver(() => enhance());
    observer.observe(stage, { childList: true, subtree: true });
  }

  window.PipelineStepDeckEnhancements = Object.freeze({ version: VERSION, enhance, synchronizeProgressCounter });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
}());
