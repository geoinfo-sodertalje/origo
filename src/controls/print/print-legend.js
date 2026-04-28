import { ImageArcGISRest, ImageWMS } from 'ol/source';
import { Component } from '../../ui';
import { isHidden, renderSvgIcon } from '../../utils/legendmaker';

/**
 * More information: https://developers.arcgis.com/rest/services-reference/enterprise/legend-map-service-.htm
 *
 * @typedef {{
 *   layers: {
 *     layerId: string,
 *     layerName: string,
 *     layerType: string,
 *     minScale: number,
 *     maxScale: number,
 *     legend: {
 *       label: string,
 *       url: string,
 *       imageData: string,
 *       contentType: string,
 *       height: number,
 *       width: number,
 *       values: string[]
 *     }[]
 *   }[]
 * }} ArcGISLegendResponse
 */

/**
 * @param {{layer: Layer, viewer: Viewer}} options
 * @returns {string}
 */
const LayerRow = function LayerRow(options) {
  const {
    layer,
    viewer
  } = options;

  /**
   * @param {Layer} aLayer
   * @returns {string|null}
   */
  const getOneUrl = (aLayer) => {
    const source = aLayer.getSource();
    if ((source instanceof ImageWMS || source instanceof ImageArcGISRest) && typeof source.getUrl === 'function') {
      return source.getUrl();
    } else if (typeof source.getUrls === 'function') {
      return source.getUrls()[0];
    }
    return null;
  };

  /**
   * Helper that creates a WMS getLegendGraphics request url string
   * @param {any} url base url
   * @param {any} layerName name of layer to create legend for
   * @param {any} format valid mime type
   * @returns {string} A WMS getLegendGraphics request url string
   */
  const createGetlegendGrapicUrl = (url, layerName, format, extraParams = {}) => {
    const params = new URLSearchParams({
      SERVICE: 'WMS',
      layer: layerName,
      format,
      version: '1.1.1',
      request: 'getLegendGraphic',
      scale: '401',
      legend_options: 'dpi:300',
      ...extraParams
    });
    return `${url}?${params.toString()}`;
  };

  /**
   * @param {string} url
   * @param {Record<string, string>} params
   * @returns {string}
   */
  const appendUrlParams = (url, params = {}) => {
    if (!url || !params || !Object.keys(params).length) {
      return url;
    }
    try {
      const parsedUrl = new URL(url, window.location.href);
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && !parsedUrl.searchParams.has(key)) {
          parsedUrl.searchParams.set(key, `${value}`);
        }
      });
      return parsedUrl.toString();
    } catch (error) {
      console.warn(error);
      return url;
    }
  };

  /**
   * @param {Layer} aLayer
   * @returns {'Geoserver'|'QGIS'|'ArcGIS'|'Unknown'}
   */
  const getSourceType = (aLayer) => {
    const mapSource = viewer.getMapSource();
    const sourceName = aLayer.get('sourceName');
    const sourceDef = mapSource[sourceName];
    const sourceVendor = typeof sourceDef?.type === 'string' ? sourceDef.type : '';
    const sourceUrl = (getOneUrl(aLayer) || '').toLowerCase();

    if (sourceVendor === 'Geoserver' || sourceUrl.includes('geoserver')) {
      return 'Geoserver';
    }
    if (sourceVendor === 'QGIS' || sourceUrl.includes('qgis')) {
      return 'QGIS';
    }
    if (sourceVendor === 'ArcGIS') {
      return 'ArcGIS';
    }
    return 'Unknown';
  };

  /**
   * Returns the URL to the WMS legend in the specified format
   *
   * @param {Layer} aLayer
   * @param {"image/png"|"application/json"} format
   * @returns {string|null}
   */
  const getWMSLegendUrl = (aLayer, format) => {
    const url = getOneUrl(aLayer);
    const layerName = aLayer.get('name');
    const sourceType = getSourceType(aLayer);
    const legendParams = aLayer.get('legendParams') || {};
    const qgisSizeParams = sourceType === 'QGIS'
      ? {
          WIDTH: legendParams.WIDTH || legendParams.SYMBOLWIDTH || '24',
          HEIGHT: legendParams.HEIGHT || legendParams.SYMBOLHEIGHT || '24'
        }
      : {};
    const style = viewer.getStyle(aLayer.get('styleName'));
    if (style && style[0] && style[0][0] && style[0][0].icon) {
      if (format === 'application/json' && style[0][0].icon.json) {
        return appendUrlParams(style[0][0].icon.json, qgisSizeParams);
      }
      const formattedSrc = appendUrlParams(style[0][0].icon.src, qgisSizeParams);
      if (style[0][0].icon.src.includes('?')) {
        return `${formattedSrc}&format=${format}`;
      }
      return `${formattedSrc}?format=${format}`;
    }
    const extraParams = sourceType === 'QGIS' ? qgisSizeParams : {};
    return createGetlegendGrapicUrl(url, layerName, format, extraParams);
  };

  /**
   * Returns the JSON-encoded legend from the ArcGIS Legend Map Service
   *
   * More information: https://developers.arcgis.com/rest/services-reference/enterprise/legend-map-service-.htm
   *
   * @param {Layer} aLayer
   * @param {number} dpi
   * @returns {Promise<ArcGISLegendResponse>}
   */
  const getAGSLegendJSON = async (aLayer, dpi = 150) => {
    // rewrite the URL if needed
    const mapServerUrl = getOneUrl(aLayer).replace(/\/arcgis(\/rest)?\/services\/([^/]+\/[^/]+)\/MapServer\/WMSServer/, '/arcgis/rest/services/$2/MapServer');
    const url = `${mapServerUrl}/legend?f=json&dpi=${dpi}`;
    try {
      const response = await fetch(url);
      return await response.json();
    } catch (e) {
      console.warn(e);
      return null;
    }
  };

  /**
   * @param {string|null} url
   * @returns {Promise<null|any>}
   */
  const getLegendGraphicJSON = async (url) => {
    try {
      if (!url) {
        return null;
      }
      const response = await fetch(url);
      return await response.json();
    } catch (e) {
      console.warn(e);
      return null;
    }
  };

  /**
   * Resolve icon URL returned by legend JSON to an absolute usable URL.
   *
   * @param {string} baseLegendUrl
   * @param {string|undefined} iconCandidate
   * @returns {string}
   */
  const resolveLegendIconUrl = (baseLegendUrl, iconCandidate) => {
    if (!iconCandidate || typeof iconCandidate !== 'string') {
      return '';
    }
    if (iconCandidate.startsWith('data:')) {
      return iconCandidate;
    }
    if (iconCandidate.startsWith('base64,')) {
      return `data:image/png;base64,${iconCandidate.slice(7)}`;
    }
    const looksLikeBase64 = /^[A-Za-z0-9+/]+={0,2}$/.test(iconCandidate) && iconCandidate.length > 64;
    if (looksLikeBase64) {
      return `data:image/png;base64,${iconCandidate}`;
    }
    try {
      return new URL(iconCandidate, baseLegendUrl).toString();
    } catch (error) {
      console.warn(error);
      return iconCandidate;
    }
  };

  /**
   * Normalize GeoServer and QGIS GetLegendGraphic JSON into a common structure.
   *
   * @param {any} json
   * @returns {{backend: 'Geoserver'|'QGIS', layers: {layerName: string, rules: {name?: string, title?: string, icon?: string}[]}[]}|null}
   */
  const normalizeWMSLegendJSON = (json, legendJsonUrl = '') => {
    if (json && Array.isArray(json.Legend)) {
      return {
        backend: 'Geoserver',
        layers: json.Legend.map((legendLayer) => ({
          layerName: legendLayer.layerName || '',
          rules: Array.isArray(legendLayer.rules) ? legendLayer.rules : []
        }))
      };
    }

    if (json && Array.isArray(json.nodes)) {
      const layers = [];
      const mapSymbolToRule = (symbol = {}) => {
        const rawIcon = typeof symbol.icon === 'string'
          ? symbol.icon
          : (symbol.icon && (symbol.icon.href || symbol.icon.url || symbol.icon.src || symbol.icon.base64)) || symbol.image || symbol.src || '';
        const iconMimeType = symbol.contentType || symbol.mimetype || symbol.mimeType || symbol.icon?.contentType || 'image/png';
        const iconValue = resolveLegendIconUrl(legendJsonUrl, rawIcon);
        const finalIconValue = (iconValue.startsWith('data:image/png;base64,') && iconMimeType !== 'image/png')
          ? iconValue.replace('data:image/png;base64,', `data:${iconMimeType};base64,`)
          : iconValue;
        return {
          name: symbol.name || symbol.rule || '',
          title: symbol.title || symbol.label || symbol.name || '',
          icon: finalIconValue
        };
      };

      const collectNode = (node, inheritedLayerName = '') => {
        if (!node || typeof node !== 'object') {
          return;
        }

        const layerName = node.layerName || node.name || node.title || inheritedLayerName || layer.get('id') || layer.get('name');
        const symbols = Array.isArray(node.symbols) ? node.symbols : [];

        if (symbols.length > 0) {
          layers.push({
            layerName,
            rules: symbols.map(mapSymbolToRule)
          });
        } else if (node.icon) {
          layers.push({
            layerName,
            rules: [mapSymbolToRule(node)]
          });
        }

        const childNodes = [];
        if (Array.isArray(node.nodes)) {
          childNodes.push(...node.nodes);
        }
        if (Array.isArray(node.children)) {
          childNodes.push(...node.children);
        }
        childNodes.forEach((childNode) => collectNode(childNode, layerName));
      };

      json.nodes.forEach((node) => collectNode(node));
      if (layers.length > 0) {
        return {
          backend: 'QGIS',
          layers
        };
      }
    }

    return null;
  };

  /**
   * @param {string} title
   * @param {string[]} children
   * @returns {string}
   */
  const getTitleWithChildren = (title, children) => `
    <div class="flex row">
      <div class="padding-x-small grow no-select overflow-hidden">${title}</div>
    </div>
    <div class="padding-left">
      <ul style="margin-top:0.2rem;">${children.join('\n')}</ul>
    </div>`;

  /**
   * @param {string} title
   * @param {string} icon
   * @returns {string}
   */
  const getTitleWithIcon = (title, icon) => `
    <div class="flex row">
      <div class="grey-lightest ${icon.includes('<img') ? '' : 'round '}compact icon-small light relative no-shrink legend-icon" style="height: ${icon.includes('<img') ? '1.9rem' : '1.65rem'}; width: ${icon.includes('<img') ? '1.9rem' : '1.65rem'}; overflow: visible;">
        <span class="icon">
          ${icon}
        </span>
      </div>
      <div class="padding-x-small grow no-select overflow-hidden">${title}</div>
    </div>`;

  /**
   * @param {string} title
   * @param {string} icon
   * @param {boolean} iconLink
   * @returns {string}
   */
  const getListItem = (title, icon, iconLink = false) => {
    const iconElement = iconLink ? `<img src="${icon}" style="display:block;width:auto;height:100%;max-width:none;object-fit:contain;" title="" alt="${title}"/>` : icon;
    const iconSize = iconLink ? '1.9rem' : '1.65rem';
    const rowPadding = iconLink ? '0.2rem 0' : '0';
    return `
      <li class="flex row align-center padding-left padding-right item" style="padding:${rowPadding};">
        <div class="flex column">
          <div class="flex row" style="gap:0.35rem; align-items:center;">
            <div class="grey-lightest ${iconLink ? '' : 'round '}compact icon-small light relative no-shrink legend-icon" style="height: ${iconSize}; width: ${iconSize}; overflow: visible;">
              ${iconElement}
            </div>
            <div class="padding-left-small grow no-select overflow-hidden">${title}</div>
          </div>
        </div>
      </li>`;
  };

  const getStyleIcon = (style) => {
    const styleIcon = renderSvgIcon(style, { opacity: 100 });
    if (styleIcon.includes('<svg')) {
      return styleIcon.replaceAll('24px', '100%');
    }
    return styleIcon.replaceAll('style=""', 'style="height:100%;"');
  };

  const getStyleContent = (title, style) => {
    if (style.length < 2) {
      return getTitleWithIcon(title, getStyleIcon(style[0]));
    }

    const hasThematicStyle = (layer.get('thematicStyling') === true);
    const children = style.map((thisStyle, index) => {
      if (!(isHidden(thisStyle))) {
        if ((!(hasThematicStyle)) || (!(thisStyle[0]?.visible === false))) {
          const styleIcon = getStyleIcon(thisStyle);
          const rowTitle = thisStyle[0].label ? thisStyle[0].label : index + 1;
          return getListItem(rowTitle, styleIcon);
        }
      }
      return '';
    });
    return getTitleWithChildren(title, children);
  };

  /**
   * @param {string} title
   * @param {string} imageUrl
   * @returns {string}
   */
  const getTitleWithImage = (title, imageUrl) => `
    <div class="flex row">
      <div class="padding-x-small grow no-select overflow-hidden">${title}</div>
    </div>
    <div class="padding-left">
      <img src="${imageUrl}" alt="${title}" style="max-height:1.5rem;width:auto;object-fit:contain;" />
    </div>`;

  /**
   * For GROUP layers we always use configured style for print legend,
   * including extendedLegend image definitions.
   *
   * @param {string} title
   * @param {any[][]} style
   * @returns {string}
   */
  const getGroupStyleContent = async (title, style) => {
    const extendedLegendItem = style
      .flat()
      .find((styleItem) => styleItem.extendedLegend && styleItem.icon && styleItem.icon.src);

    if (extendedLegendItem) {
      const iconSrc = extendedLegendItem.icon.src;
      const iconJson = extendedLegendItem.icon.json
        || (iconSrc.includes('?') ? `${iconSrc}&format=application/json` : `${iconSrc}?format=application/json`);
      const shouldTryJson = !!extendedLegendItem.icon.json || /getlegendgraphic|service=wms/i.test(iconSrc);

      if (shouldTryJson) {
        const json = await getLegendGraphicJSON(iconJson);
        const normalizedLegend = normalizeWMSLegendJSON(json, iconJson);
        if (normalizedLegend) {
          const rules = [];
          normalizedLegend.layers.forEach((legendLayer) => {
            legendLayer.rules.forEach((legendRule, index) => {
              let iconUrl = iconSrc;
              if (normalizedLegend.backend === 'QGIS') {
                iconUrl = legendRule.icon || iconSrc;
              } else if (legendLayer.rules.length > 1 && legendRule.name) {
                iconUrl = `${iconSrc}${iconSrc.includes('?') ? '&' : '?'}rule=${legendRule.name}`;
              }
              const rowTitle = legendRule.title || legendRule.name || index + 1;
              rules.push(getListItem(rowTitle, iconUrl, true));
            });
          });
          if (rules.length) {
            return getTitleWithChildren(title, rules);
          }
        }
      }

      return getTitleWithImage(title, iconSrc);
    }

    return getStyleContent(title, style);
  };

  /**
   * Return the HTML for a legend based for a WMS layer
   *
   * @param {string} title
   * @returns {Promise<string>}
   */
  const getWMSJSONContent = async (title) => {
    const getLegendGraphicUrl = getWMSLegendUrl(layer, 'image/png');
    const jsonLegendUrl = getWMSLegendUrl(layer, 'application/json');
    const json = await getLegendGraphicJSON(jsonLegendUrl);

    if (!json) {
      return `
        <div class="flex row">
          <div class="padding-x-small grow no-select overflow-hidden">${title}</div>
        </div>
        <div class="padding-left">
          <img src="${getLegendGraphicUrl}" alt="${title}" />
        </div>`;
    }
    const normalizedLegend = normalizeWMSLegendJSON(json, jsonLegendUrl);
    if (!normalizedLegend) {
      return `
        <div class="flex row">
          <div class="padding-x-small grow no-select overflow-hidden">${title}</div>
        </div>
        <div class="padding-left">
          <img src="${getLegendGraphicUrl}" alt="${title}" />
        </div>`;
    }

    // Handle the simple one first. One layer, one rule
    if (normalizedLegend.layers.length === 1 && normalizedLegend.layers[0].rules.length <= 1) {
      const singleRule = normalizedLegend.layers[0].rules[0];
      const iconUrl = normalizedLegend.backend === 'QGIS' && singleRule?.icon ? singleRule.icon : getLegendGraphicUrl;
      const icon = `<img src="${iconUrl}" style="display:block;width:auto;height:100%;max-width:none;object-fit:contain;" alt="${title}"/>`;
      return getTitleWithIcon(title, icon);
    }

    const thematicStyle = (layer.get('thematicStyling') === true) ? viewer.getStyle(layer.get('styleName')) : undefined;
    // thematic is populated lazily by the interactive legend (setIcon). If not yet loaded, default to showing all rules.
    const thematicLoaded = thematicStyle && Array.isArray(thematicStyle[0]?.thematic) && thematicStyle[0].thematic.length > 0;
    const rules = [];
    let index = 0;
    const layerName = layer.get('id');
    const isLayerGroup = normalizedLegend.layers.length > 1;
    // Loop all layers in json response. Usually there is only one, but Layer Groups have several.
    normalizedLegend.layers.forEach(currLayer => {
      let currLayerName = currLayer.layerName;
      currLayer.rules.forEach(currRule => {
        if (!layer.get('thematicStyling') || !thematicLoaded || thematicStyle[0].thematic[index]?.visible) {
          let layerImageUrl;
          if (normalizedLegend.backend === 'QGIS') {
            layerImageUrl = currRule.icon || getLegendGraphicUrl;
          } else if (isLayerGroup) {
            // This is layer group and the contained layer is most likely not known to us,
            // so we can't treat is as an Origo layer.
            // Generate a request and hope that the server has a layer by that name.
            const baseUrl = getOneUrl(layer);
            const layerWs = layerName.split(':');
            if (layerWs.length > 1) {
              currLayerName = `${layerWs[0]}:${currLayer.layerName}`;
            }
            // This is a little bit shaky, if Layer Group name constains workspace, contained layers must come from
            // the same workspace, but if layer group is a top level layer group (no workspace), contained layers can
            // come from any workspace but the json response NEVER contains info about workspace.
            // So for Layer Groups with a workspace prefix we can assume that the actual layers should have the same workspace prefix,
            // but for top level Layer Groups we have absolutely no idea which workspace the layer is in.
            // But not all is lost as Geoserver tries its best to get the legend for any workspace with that layer name.
            // Problem is when the same layer name appears in several workspaces. In that case you get from what is configured as default.
            // One more tricky thing is that layer groups can configure different symbols than the actual layer.
            // Querying the layer Group for png will return the group layer style, but the getLegendGrapich for each layer
            // will return the symbol for the actual layer, so legend and print legend will differ.
            layerImageUrl = createGetlegendGrapicUrl(baseUrl, currLayerName, 'image/png');
          } else {
            layerImageUrl = getLegendGraphicUrl;
          }
          let ruleImageUrl = `${layerImageUrl}`;
          // Add specific rule if necessary. If there is only one rule there is no need (in fact it will probably break as most
          // styles using only one rule will not have a named rule). This is to handle Layer Groups without rules in some of the contained
          // layer's style
          if (normalizedLegend.backend === 'Geoserver' && currLayer.rules.length > 1) {
            ruleImageUrl += `&rule=${currRule.name}`;
          }
          const rowTitle = currRule.title ? currRule.title : index + 1;
          rules.push(getListItem(rowTitle, ruleImageUrl, true));
        }
        index += 1;
      });
    });

    if (!rules.length) {
      const icon = `<img src="${getLegendGraphicUrl}" style="display:block;width:auto;height:100%;max-width:none;object-fit:contain;" alt="${title}"/>`;
      return getTitleWithIcon(title, icon);
    }

    return getTitleWithChildren(title, rules);
  };

  /**
   * Return the HTML for a legend based for a ArcGIS MapServer layer
   *
   * @param {string} title
   * @param {string} id
   * @returns {Promise<string>}
   */
  const getAGSJSONContent = async (title, id) => {
    const json = await getAGSLegendJSON(layer);
    if (!json) {
      return getTitleWithIcon(title, '');
    }
    const legendLayer = json.layers.find((l) => +l.layerId === +id || l.layerName === id);
    if (!legendLayer) {
      return getTitleWithIcon(title, '');
    }
    const rules = legendLayer.legend.map((l) => getListItem(l.label, `data:${l.contentType};base64,${l.imageData}`, true));
    return getTitleWithChildren(title, rules);
  };

  return Component({
    async render() {
      const title = layer.get('title') || 'Titel saknas';
      let content = '';
      const style = viewer.getStyle(layer.get('styleName'));
      const lType = (layer.get('type') || '').toUpperCase();
      if (style && style[0] && (!style[0][0].extendedLegend || lType === 'GROUP')) {
        content = lType === 'GROUP' ? await getGroupStyleContent(title, style) : getStyleContent(title, style);
      } else {
        content = getTitleWithIcon(title, '');
        if ((lType && lType.includes('AGS')) || /\/arcgis\/services\/[^/]+\/[^/]+\/MapServer\/WMSServer/.test(getOneUrl(layer))) {
          content = await getAGSJSONContent(title, layer.get('id'));
        } else if (lType && lType.includes('WMS')) {
          content = await getWMSJSONContent(title);
        }
      }
      return `
          <li id="${this.getId()}" class="flex row align-center padding-left padding-right item legend-${layer.get('type')}">
            <div class="flex column">
              ${content}
            </div>
          </li>`;
    }
  });
};

const LayerRows = function LayerRows(options) {
  const {
    viewer
  } = options;

  return Component({
    async render() {
      const overlays = viewer.getLayers().filter((layer) => layer.get('group') !== 'background' && layer.get('group') !== 'none' && layer.get('visible'));
      const overlayEls = [];

      overlays.forEach((layer) => {
        if (!layer.get('drawlayer')) {
          overlayEls.push(LayerRow({ layer, viewer }));
        }
      });
      const layerListCmp = Component({
        async render() {
          const rowPromises = overlayEls.map((item) => item.render());
          const rows = await Promise.all(rowPromises);
          return `<ul id="${this.getId()}" class="list">${rows.reverse().join('')}</ul>`;
        }
      });
      return `
        <div id="${this.getId()}" class="overflow-hidden" style="height: 100%;">
          <div class="flex column overflow-hidden width-100" style="width: 100%">
            ${await layerListCmp.render()}
          </div>
        </div>`;
    }
  });
};

export default function PrintLegend(options = {}) {
  const {
    viewer
  } = options;

  const setVisible = (display) => {
    document.getElementById('legendContainer').hidden = !display.showPrintLegend;
  };

  return Component({
    setVisible(display) {
      setVisible(display);
    },
    async render() {
      const overlaysCmp = LayerRows({
        viewer
      });

      return `
        <div id="legendContainer">
          <div class="control overflow-hidden flex row o-legend o-no-boxshadow">
            <div class="flex column overflow-hidden relative">
              ${await overlaysCmp.render()}
            </div>
          </div>
        </div>`;
    }
  });
}
