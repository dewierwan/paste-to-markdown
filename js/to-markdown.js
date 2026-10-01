// HTML → Markdown writer, plus clean-up passes for Markdown pasted from other tools.
// (Extracted unchanged from the original single-file paste-to.md, except nested lists.)
// When plain markdown is pasted, the browser hands us a single <pre>, which the
// converter wraps in a code fence. Strip the outer fence so pasted markdown round-
// trips cleanly. Bail out if the inner content contains its own fences (real code
// blocks should pass through untouched).
function stripWrappingFence(markdown) {
  const trimmed = markdown.trim();
  const match = trimmed.match(/^```[^\n]*\n([\s\S]*)\n```$/);
  if (!match) return markdown;
  if (/^```/m.test(match[1])) return markdown;
  return match[1];
}

// Google Docs' "Copy as Markdown" over-escapes punctuation that has no markdown
// meaning (\~, \., \<, \>, \$, \&). Strip those backslashes so the output matches
// the source. Negative lookbehind avoids rewriting a literal escaped backslash.
function unescapeOverEscaped(markdown) {
  return markdown.replace(/(?<!\\)\\([~.<>$&])/g, "$1");
}

// Strip image markdown so pasted Google Docs base64 blobs never reach the output.
function stripImages(markdown) {
  return markdown
    // Reference definitions pointing to data: URLs (the massive base64 blob).
    .replace(/^[ \t]*\[[^\]\n]+\]:[ \t]*<?\s*data:[^\n]*>?[ \t]*$/gim, "")
    // Inline images: ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    // Reference-style images: ![alt][ref]
    .replace(/!\[[^\]]*\]\[[^\]]*\]/g, "")
    // Tidy: trim trailing spaces per line, collapse 3+ blank lines to 2.
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n");
}

// Convert the entire HTML content into Markdown.
function convertToMarkdown(htmlContent) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlContent;
  return convertNodeToMarkdown(tempDiv).replace(/\n{3,}/g, '\n\n').trim();
}

// Escape characters that would otherwise be parsed as Markdown formatting.
// Conservative set: chars that are inline-meaningful in any position.
function escapeMarkdown(text) {
  return text.replace(/([\\`*_\[\]~])/g, '\\$1');
}

// Markers must touch the text: "**bold** " is bold, "**bold **" is not.
// Move edge whitespace outside the markers; skip whitespace-only runs.
function wrapMarkdown(marker, text) {
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  return match[2] ? match[1] + marker + match[2] + marker + match[3] : text;
}

// Recursively convert a node to Markdown.
function convertNodeToMarkdown(node, indentLevel = 0, listIndex = null) {
  let markdown = "";
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(node.textContent);
  } else if (node.nodeType === Node.ELEMENT_NODE) {
    const tag = node.tagName.toLowerCase();
    switch (tag) {
      case 'h1':
        return "# " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'h2':
        return "## " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'h3':
        return "### " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'h4':
        return "#### " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'h5':
        return "##### " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'h6':
        return "###### " + getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'strong':
      case 'b':
        return wrapMarkdown("**", getInnerMarkdown(node, indentLevel));
      case 'em':
      case 'i':
        return wrapMarkdown("*", getInnerMarkdown(node, indentLevel));
      case 's':
      case 'strike':
      case 'del':
        return wrapMarkdown("~~", getInnerMarkdown(node, indentLevel));
      case 'mark':
        return "<mark>" + getInnerMarkdown(node, indentLevel) + "</mark>";
      case 'sub':
        return "<sub>" + getInnerMarkdown(node, indentLevel) + "</sub>";
      case 'sup':
        return "<sup>" + getInnerMarkdown(node, indentLevel) + "</sup>";
      case 'code':
        return "`" + node.textContent + "`";
      case 'pre': {
        // Language hint: data-language (Notion) or class="language-xyz" (Prism)
        let lang = node.getAttribute('data-language') || '';
        if (!lang) {
          const codeChild = node.querySelector('code');
          const target = codeChild || node;
          const langClass = Array.from(target.classList).find(c => c.startsWith('language-'));
          if (langClass) lang = langClass.slice(9);
        }
        return "```" + lang + "\n" + node.textContent + "\n```\n\n";
      }
      case 'blockquote': {
        const blockquoteContent = getInnerMarkdown(node, indentLevel);
        return blockquoteContent.split('\n')
          .map(line => line.trim() ? "> " + line : line)
          .join('\n') + "\n\n";
      }
      case 'ul': {
        let ulMarkdown = "";
        Array.from(node.children).forEach(child => {
          if (child.tagName.toLowerCase() === 'li') {
            ulMarkdown += convertNodeToMarkdown(child, indentLevel);
          }
        });
        return ulMarkdown + "\n"; // blank line after the list, as for <ol>
      }
      case 'ol': {
        let olMarkdown = "\n";
        let counter = 1;
        Array.from(node.children).forEach(child => {
          if (child.tagName.toLowerCase() === 'li') {
            olMarkdown += convertNodeToMarkdown(child, indentLevel, counter);
            counter++;
          }
        });
        return olMarkdown + "\n";
      }
      case 'li': {
        let indent = indentLevel;
        node.classList.forEach(cls => {
          if (cls.indexOf("ql-indent-") === 0) {
            const level = parseInt(cls.substring(10));
            if (!isNaN(level)) {
              indent = level;
            }
          }
        });
        let prefix = "";
        if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'ul' && node.parentElement.hasAttribute("data-checked")) {
          let isChecked = node.parentElement.getAttribute("data-checked") === "true";
          prefix = "  ".repeat(indent) + (isChecked ? "- [x] " : "- [ ] ");
        } else {
          // Check for checkbox inside the list item.
          let checkbox = node.querySelector('input[type="checkbox"]');
          if (checkbox) {
            prefix = "  ".repeat(indent) + (checkbox.checked ? "- [x] " : "- [ ] ");
            checkbox.remove();
          } else if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol') {
            prefix = "  ".repeat(indent) + (listIndex !== null ? listIndex + ". " : "1. ");
          } else {
            prefix = "  ".repeat(indent) + "- ";
          }
        }
        // Nested lists go on their own lines, one level deeper.
        let liContent = "";
        let nested = "";
        node.childNodes.forEach(child => {
          if (child.nodeType === Node.ELEMENT_NODE && /^(ul|ol)$/i.test(child.tagName)) {
            let sub = convertNodeToMarkdown(child, indent + 1).replace(/^\n+|\n+$/g, "");
            // Under "1. " content starts at column 3, so nest one space deeper.
            if (node.parentElement && node.parentElement.tagName.toLowerCase() === 'ol') sub = sub.replace(/^/gm, " ");
            nested += sub + "\n";
          } else {
            liContent += convertNodeToMarkdown(child, indent);
          }
        });
        return prefix + liContent.trim() + "\n" + nested;
      }
      case 'a': {
        const href = node.getAttribute("href") || "";
        return "[" + getInnerMarkdown(node, indentLevel) + "](" + href + ")";
      }
      case 'img': {
        const src = node.getAttribute("src") || "";
        const alt = node.getAttribute("alt") || "";
        const title = node.getAttribute("title");
        if (!src) return "";
        return title ? "![" + alt + "](" + src + " \"" + title + "\")" : "![" + alt + "](" + src + ")";
      }
      case 'hr':
        return "\n---\n\n";
      case 'br':
        return "\n";
      case 'p':
        return getInnerMarkdown(node, indentLevel) + "\n\n";
      case 'table': {
        const allRows = Array.from(node.querySelectorAll('tr'));
        if (allRows.length === 0) return "";
        const theadRows = Array.from(node.querySelectorAll('thead tr'));
        let headerRow, bodyRows;
        if (theadRows.length > 0) {
          headerRow = theadRows[0];
          bodyRows = allRows.filter(r => !theadRows.includes(r));
        } else {
          headerRow = allRows[0];
          bodyRows = allRows.slice(1);
        }
        const cellsOf = (tr) => Array.from(tr.children).filter(c => /^t[hd]$/i.test(c.tagName));
        const renderRow = (tr) => {
          const cells = cellsOf(tr);
          return "| " + cells.map(cell => {
            const inner = getInnerMarkdown(cell, 0).trim().replace(/\|/g, '\\|').replace(/\n+/g, ' ');
            return inner || ' ';
          }).join(" | ") + " |";
        };
        const colCount = cellsOf(headerRow).length;
        if (colCount === 0) return "";
        let table = renderRow(headerRow) + "\n";
        table += "|" + " --- |".repeat(colCount) + "\n";
        bodyRows.forEach(tr => { table += renderRow(tr) + "\n"; });
        return "\n" + table + "\n";
      }
      case 'span': {
        let text = getInnerMarkdown(node, indentLevel);
        // Check classes for formatting
        let isBold = node.classList.contains("ql-bold");
        let isItalic = node.classList.contains("ql-italic");
        // Also check inline style if classes are not present.
        if (!isBold && node.style && node.style.fontWeight) {
          const weight = node.style.fontWeight;
          if (weight === "bold" || parseInt(weight) >= 600) {
            isBold = true;
          }
        }
        if (!isItalic && node.style && node.style.fontStyle) {
          const style = node.style.fontStyle;
          if (style === "italic") {
            isItalic = true;
          }
        }
        let trailingSpaces = '';
        let mainText = text;
        let match = text.match(/(\s+)$/);
        if (match) {
          trailingSpaces = match[1];
          mainText = text.slice(0, -trailingSpaces.length);
        }
        if (isBold && isItalic) {
          return "***" + mainText + "***" + trailingSpaces;
        } else if (isBold) {
          return "**" + mainText + "**" + trailingSpaces;
        } else if (isItalic) {
          return "*" + mainText + "*" + trailingSpaces;
        }
        return text;
      }
      default:
        return getInnerMarkdown(node, indentLevel);
    }
  }
  return "";
}

// Process all child nodes of a given node.
function getInnerMarkdown(node, indentLevel) {
  let result = "";
  node.childNodes.forEach(child => {
    result += convertNodeToMarkdown(child, indentLevel);
  });
  return result;
}

