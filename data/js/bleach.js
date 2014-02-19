// UMD boilerplate to work across node/AMD/naked browser:
// https://github.com/umdjs/umd
(function (root, factory) {
    if (typeof exports === 'object') {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like enviroments that support module.exports,
        // like Node.
        module.exports = factory();
    } else if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define(factory);
    } else {
        // Browser globals
        root.Bleach = factory();
    }
}(this, function () {

var ALLOWED_TAGS = [
    'a',
    'abbr',
    'acronym',
    'b',
    'blockquote',
    'code',
    'em',
    'i',
    'li',
    'ol',
    'strong',
    'ul'
];
var ALLOWED_ATTRIBUTES = {
    'a': ['href', 'title'],
    'abbr': ['title'],
    'acronym': ['title']
};
var ALLOWED_STYLES = [];

var Node = {
  ELEMENT_NODE                :  1,
  ATTRIBUTE_NODE              :  2,
  TEXT_NODE                   :  3,
  CDATA_SECTION_NODE          :  4,
  ENTITY_REFERENCE_NODE       :  5,
  ENTITY_NODE                 :  6,
  PROCESSING_INSTRUCTION_NODE :  7,
  COMMENT_NODE                :  8,
  DOCUMENT_NODE               :  9,
  DOCUMENT_TYPE_NODE          : 10,
  DOCUMENT_FRAGMENT_NODE      : 11,
  NOTATION_NODE               : 12
};

var DEFAULTS = {
  tags: ALLOWED_TAGS,
  prune: [],
  attributes: ALLOWED_ATTRIBUTES,
  styles: ALLOWED_STYLES,
  strip: false,
  stripComments: true
};

// strategies:
//   * loop over .attributes, remove anything not in the whitelist
//   * style|script: document.createTextElement(el.outerHTML);

function match (obj, key) {
}

var bleach = {};

bleach._preCleanNodeHack = null;

// This is for web purposes; node will clobber this with 'jsdom'.
bleach.documentConstructor = function() {
  // Per hsivonen, this creates a document flagged as "loaded as data" which is
  // desirable for safety reasons as it avoids pre-fetches, etc.
  return document.implementation.createHTMLDocument('');
};

/**
 * Clean a string.
 */
bleach.clean = function (html, opts) {
  if (!html) return '';

  var document = bleach.documentConstructor(),
      dirty = document.createElement('dirty');

  dirty.innerHTML = html;

  if (bleach._preCleanNodeHack)
    bleach._preCleanNodeHack(dirty, html);
  bleach.cleanNode(dirty, opts);

  var asNode = opts && opts.hasOwnProperty("asNode") && opts.asNode;
  if (asNode)
    return dirty;
  return dirty.innerHTML;
};

/**
 * Clean the children of a node, but not the node itself.  Maybe this is
 * a bad idea.
 */
bleach.cleanNode = function(dirtyNode, opts) {
  var document = dirtyNode.ownerDocument;
  opts = opts || DEFAULTS;
  var doStrip = opts.hasOwnProperty('strip') ? opts.strip : DEFAULTS.strip,
      doStripComments = opts.hasOwnProperty('stripComments') ?
                          opts.stripComments : DEFAULTS.stripComments,
      allowedTags = opts.hasOwnProperty('tags') ? opts.tags : DEFAULTS.tags,
      pruneTags = opts.hasOwnProperty('prune') ? opts.prune : DEFAULTS.prune,
      attrsByTag = opts.hasOwnProperty('attributes') ? opts.attributes
                                                     : DEFAULTS.attributes,
      allowedStyles = opts.hasOwnProperty('styles') ? opts.styles
                                                    : DEFAULTS.styles,
      reCallbackOnTag = opts.hasOwnProperty('callbackRegexp') ? opts.callbackRegexp
                                                              : null,
      reCallback = reCallbackOnTag && opts.callback,
      wildAttrs;
  if (Array.isArray(attrsByTag)) {
    wildAttrs = attrsByTag;
    attrsByTag = {};
  }
  else if (attrsByTag.hasOwnProperty('*')) {
    wildAttrs = attrsByTag['*'];
  }
  else {
    wildAttrs = [];
  }

  function slashAndBurn(root, callback) {
    var child, i = 0;
    // console.log('slashing');
    // console.log('type ', root.nodeType);
    // console.log('value', root.nodeValue||['<',root.tagName,'>'].join(''));
    // console.log('innerHTML', root.innerHTML);
    // console.log('--------');

    // TODO: investigate whether .nextSibling is faster/more GC friendly
    while ((child = root.childNodes[i++])) {
      if (child.nodeType === 8 && doStripComments) {
        root.removeChild(child);
        continue;
      }
      if (child.nodeType === 1) {
        var tag = child.tagName.toLowerCase();
        if (allowedTags.indexOf(tag) === -1) {
          // The tag is not in the whitelist.

          // Strip?
          if (doStrip) {
            // Should this tag and its children be pruned?
            // (This is not the default because new HTML tags with semantic
            // meaning can be added and should not cause content to disappear.)
            if (pruneTags.indexOf(tag) !== -1) {
              root.removeChild(child);
              // This will have shifted the sibling down, so decrement so we hit
              // it next.
              i--;
            }
            // Not pruning, so move the children up.
            else {
              while (child.firstChild) {
                root.insertBefore(child.firstChild, child);
              }
              root.removeChild(child);
              // We want to make sure we process all of the children, so
              // decrement.  Alternately, we could have called slashAndBurn
              // on 'child' before splicing in the contents.
              i--;
            }
          }
          // Otherwise, quote the child.
          // Unit tests do not indicate if this should be recursive or not,
          // so it's not.
          else {
            var textNode = document.createTextNode(child.outerHTML);
            // jsdom bug? creating a text node always adds a linebreak;
            textNode.nodeValue = textNode.nodeValue.replace(/\n$/, '');
            root.replaceChild(textNode, child);
          }
          continue;
        }

        if (child.style.length) {
          var styles = child.style;
          for (var iStyle = styles.length - 1; iStyle >= 0; iStyle--) {
            var decl = styles[iStyle];
            if (allowedStyles.indexOf(decl) === -1) {
              styles.removeProperty(decl);
            }
          }
        }

        // If a callback was specified and it matches the tag name, then invoke
        // the callback.  This happens before the style/attribute filtering so
        // that the function can observe dangerous attributes, but in the event of the (silent) failure of this function, they will still be safely removed.  This is in
        if (reCallbackOnTag && reCallbackOnTag.test(tag)) {
          reCallback(child, tag);
        }

        if (child.attributes.length) {
          var attrs = child.attributes;
          for (var iAttr = attrs.length - 1; iAttr >= 0; iAttr--) {
            var attr = attrs[iAttr];
            var whitelist = attrsByTag[tag];
            attr = attr.nodeName;
            if (wildAttrs.indexOf(attr) === -1 &&
                (!whitelist || whitelist.indexOf(attr) === -1)) {
              attrs.removeNamedItem(attr);
            }
          }
        }
      }
      slashAndBurn(child, callback);
    }
  }
  slashAndBurn(dirtyNode);
};

return bleach;

})); // close out UMD boilerplate
