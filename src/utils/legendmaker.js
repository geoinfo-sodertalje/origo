import { renderIcon, renderSvg } from './legendrender';
import { Button, Element as El } from '../ui';

const size = 24;
const checkIcon = '#ic_check_circle_24px';
const uncheckIcon = '#ic_radio_button_unchecked_24px';

export const isHidden = function isHidden(arr) {
  const hiddenItem = arr.find(item => item.hidden);
  if (hiddenItem) {
    if (hiddenItem.hidden === true) {
      return true;
    }
    return false;
  }
  return false;
};

export const findCircleSize = function findCircleSize(styles) {
  const circleSize = styles.reduce((currentMaxSize, style) => {
    let maxSize;
    if ('circle' in style) {
      const circle = style.circle;
      if (circle.radius) {
        const diameter = circle.radius * 2;
        maxSize = diameter > currentMaxSize ? diameter : currentMaxSize;
      }
    }
    return maxSize;
  }, size);
  return circleSize;
};

export const findStyleType = function findStyleType(styles) {
  const styleTypes = styles.reduce((acc, style) => Object.assign({}, acc, style), {});
  if (styleTypes.stroke && styleTypes.fill) {
    return 'Polygon';
  } else if (styleTypes.stroke) {
    return 'Line';
  } else if (styleTypes.circle) {
    return 'Circle';
  } else if (styleTypes.square) {
    return 'Square';
  } else if (styleTypes.triangle) {
    return 'Triangle';
  } else if (styleTypes.star) {
    return 'Star';
  } else if (styleTypes.pentagon) {
    return 'Pentagon';
  } else if (styleTypes.cross) {
    return 'Cross';
  } else if (styleTypes.x) {
    return 'X';
  } else if (styleTypes.icon) {
    return 'Icon';
  } else if (styleTypes.image) {
    return 'Image';
  } else if (styleTypes.text) {
    return 'Text';
  }
  return null;
};

// If there is only one styleRule that will be used as header icon, but not if that is extendedLegend. In latter case null is returned  meaning that list_icon will be set as header icon.
// If there is only one styleRule, but that consist of a compounded style it's checked to see if any of the compounded style has header=true then this is used otherwise default order is applied.
// If there are more than one styleRule the last styleRule flagged as header will be returned. In other words, if there are for example 3 styleRules
// an all of them have header=true, then the last one will be returned and set on the icon legend.
// If there are more than one styleRule but none of them has header flag, then null is returned meaning that list_icon will be set as header icon.
export const findHeaderStyle = function findHeaderStyle(styleRules) {
  if (styleRules.length === 1) {
    const icons = styleRules[0].filter(sr => sr.icon);
    if (icons && icons.length && icons[0].extendedLegend) {
      return null;
    }
    if (styleRules[0].length > 1) {
      for (let index = 0; index < styleRules[0].length; index += 1) {
        const styleRule = styleRules[0][index];
        if (styleRule.header === true) {
          return [styleRule];
        }
      }
    }
    return styleRules[0];
  }
  return styleRules.reduce((prev, styleRule) => {
    const headerItems = styleRule.filter(style => style.header);
    if (headerItems.length) {
      return styleRule;
    }
    return prev;
  }, null);
};

export const renderSvgIcon = function renderSvgIcon(styleRule, {
  opacity
} = {}) {
  const styleType = findStyleType(styleRule);
  if (styleType in renderIcon) {
    if (styleType === 'Polygon') {
      const polygonOptions = styleRule.find(style => style.fill);
      const icon = renderIcon.Polygon({
        fill: polygonOptions.fill,
        stroke: polygonOptions.stroke
      });
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Line') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.stroke) {
          return prev + renderIcon.Line({
            stroke: style.stroke
          });
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Circle') {
      const circleSize = findCircleSize(styleRule);
      const icon = styleRule.reduce((prev, style) => {
        if (style.circle) {
          return prev + renderIcon.Circle(style.circle, circleSize);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity, size: circleSize })}`;
    } else if (styleType === 'Square') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.square) {
          return prev + renderIcon.Square(style.square);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Triangle') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.triangle) {
          return prev + renderIcon.Triangle(style.triangle);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Star') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.star) {
          return prev + renderIcon.Star(style.star);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Pentagon') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.pentagon) {
          return prev + renderIcon.Pentagon(style.pentagon);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Cross') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.cross) {
          return prev + renderIcon.Cross(style.cross);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'X') {
      const icon = styleRule.reduce((prev, style) => {
        if (style.x) {
          return prev + renderIcon.X(style.x);
        }
        return prev;
      }, '');
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Text') {
      const textOptions = styleRule.find(style => style.text);
      const icon = renderIcon.Text(textOptions.text);
      return `${renderSvg(icon, { opacity })}`;
    } else if (styleType === 'Icon') {
      const iconOption = styleRule.find(style => style.icon.src);
      const icon = renderIcon.Icon(iconOption.icon);
      return icon;
    } else if (styleType === 'Image') {
      const iconOption = styleRule.find(style => style.image.src);
      const icon = renderIcon.Icon(iconOption.image);
      return icon;
    }
    return '';
  }
  return '';
};

export const renderLegendItem = function renderLegendItem(svgIcon, label = '') {
  const isImageIcon = typeof svgIcon === 'string' && svgIcon.includes('<img');
  const iconSize = size;
  const style = `style="width: ${iconSize}px; height: ${iconSize}px; overflow: visible; display:flex; align-items:center; justify-content:center;"`;
  const iconCls = isImageIcon ? '' : 'icon-small round';
  const iconHtml = isImageIcon
    ? svgIcon.replace('class="cover"', 'class="contain"')
    : svgIcon;
  const legendCmp = El({ cls: 'flex row align-center padding-y-smallest',
    innerHTML: `<div ${style} class="${iconCls}">${iconHtml}</div><div class="text-smaller padding-left-small">${label}</div>` });
  return legendCmp;
};

function getThematicWmsSourceType(layer, viewer) {
  const sourceName = layer.get('sourceName');
  const sourceDef = viewer.getMapSource()?.[sourceName];
  if (typeof sourceDef?.type === 'string') {
    return sourceDef.type;
  }
  return '';
}

function getThematicTargetLayer(layer) {
  if (!layer) {
    return null;
  }
  if (layer.get('type') !== 'GROUP') {
    return layer;
  }
  const childLayers = layer.getLayers?.().getArray?.() || [];
  return childLayers.find(child => child.get('type') === 'WMS' && child.get('thematicStyling') === true) || layer;
}

function getLegendRequestUrl(url, extraParams = {}) {
  try {
    const parsedUrl = new URL(url, window.location.href);
    Object.entries(extraParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        parsedUrl.searchParams.set(key, `${value}`);
      }
    });
    return parsedUrl;
  } catch (error) {
    console.warn(error);
    return null;
  }
}

function getThematicLegendUrls(src, sourceType, layer) {
  const baseUrl = src?.icon?.json || src?.icon?.src;
  if (!baseUrl) {
    return { json: null, png: null };
  }
  const configuredShowRuleDetails = layer?.get('legendParams')?.SHOWRULEDETAILS;
  const useShowRuleDetails = sourceType === 'QGIS' && (typeof configuredShowRuleDetails === 'undefined'
    || `${configuredShowRuleDetails}`.toUpperCase() !== 'FALSE');

  const json = getLegendRequestUrl(baseUrl, useShowRuleDetails
    ? { SHOWRULEDETAILS: 'TRUE', FORMAT: 'application/json' }
    : { FORMAT: 'application/json' });
  const png = getLegendRequestUrl(baseUrl, sourceType === 'QGIS'
    ? (useShowRuleDetails ? { SHOWRULEDETAILS: 'TRUE', FORMAT: 'image/png' } : { FORMAT: 'image/png' })
    : { FORMAT: 'image/png' });
  return { json, png };
}

function shouldSkipThematicRequests(layer, thematicArr = []) {
  if (layer?.get('thematicFilterEnabled') === false) {
    return true;
  }

  if (layer?.get('allowComplexThematicFilter') === true) {
    return false;
  }

  // Guard against advanced/catch-all rule expressions that tend to cause 403/404.
  return thematicArr.some((theme) => {
    const filter = `${theme?.filter || ''}`;
    return filter.length > 700 || /^\s*NOT\s*\(\s*\(/i.test(filter);
  });
}

function buildQgisFilter(layer, thematicArr = []) {
  const layerNameParam = layer.get('id') || layer.get('name');
  const layerNames = layerNameParam.split(',').map(name => name.trim()).filter(Boolean);
  const filterableThemes = thematicArr.filter(theme => theme.filter);
  const isGroupLayer = layer.get('type') === 'GROUP';

  if (!thematicArr.length || !layerNames.length) {
    return null;
  }

  const normalizeFilterExpr = expr => `${expr}`.replace(/\s+/g, ' ').trim();
  const normalizeForSecurity = (expr) => {
    const source = `${expr || ''}`;
    let inQuote = false;
    let out = '';

    for (let i = 0; i < source.length; i += 1) {
      const char = source[i];
      if (char === "'") {
        inQuote = !inQuote;
        out += char;
      } else if (!inQuote && (char === '(' || char === ')')) {
        out += ` ${char} `;
      } else {
        out += char;
      }
    }

    return out
      .replace(/\b(and|or|is|not|in|null)\b/gi, kw => kw.toUpperCase())
      .replace(/\s+/g, ' ')
      .trim();
  };
  const isLikelySecurityRejected = expr => /;/.test(`${expr || ''}`);
  const isHugeCatchAllExpr = (expr) => {
    const normalized = normalizeFilterExpr(expr);
    return normalized.length > 700 && /^NOT\s*\(\s*\(/i.test(normalized);
  };

  const visibleByLayer = {};
  const layersWithRules = new Set();

  filterableThemes.forEach((theme) => {
    const rawFilter = `${theme.filter}`.trim();
    if (!rawFilter) {
      return;
    }

    let targetLayer = theme._layerName;
    if (targetLayer && !layerNames.includes(targetLayer)) {
      targetLayer = null;
    }

    if (!targetLayer) {
      for (const layerName of layerNames) {
        if (rawFilter.startsWith(`${layerName}:`)) {
          targetLayer = layerName;
          break;
        }
      }
    }

    if (!targetLayer) {
      targetLayer = layerNames[0];
    }

    const cleanFilter = rawFilter.startsWith(`${targetLayer}:`) ? rawFilter.slice(targetLayer.length + 1) : rawFilter;
    const preparedFilter = normalizeForSecurity(isGroupLayer ? normalizeFilterExpr(cleanFilter) : cleanFilter);

    // Drop only clearly invalid clauses instead of sending a full FILTER that the server rejects.
    if (isLikelySecurityRejected(preparedFilter)) {
      return;
    }

    // GROUP-specific guard for very large catch-all terms that often break GetMap requests.
    if (isGroupLayer && isHugeCatchAllExpr(preparedFilter)) {
      return;
    }

    layersWithRules.add(targetLayer);
    if (!visibleByLayer[targetLayer]) {
      visibleByLayer[targetLayer] = [];
    }
    if (theme.visible) {
      visibleByLayer[targetLayer].push(preparedFilter);
    }
  });

  const filterParts = [];
  layerNames.forEach(layerName => {
    const layerThemes = thematicArr.filter(theme => theme._layerName === layerName);
    const layerNoFilterThemes = layerThemes.filter(theme => !theme.filter);
    const hideLayerByNoFilterToggle =
      layerNoFilterThemes.length > 0 && layerNoFilterThemes.every(theme => theme.visible === false);

    if (hideLayerByNoFilterToggle) {
      filterParts.push(`${layerName}:1 = 0`);
      return;
    }

    if (layersWithRules.has(layerName)) {
      const layerFilters = visibleByLayer[layerName] || [];
      if (layerFilters.length > 0) {
        const combined = layerFilters.join(' OR ');
        filterParts.push(`${layerName}:${combined}`);
      } else {
        filterParts.push(`${layerName}:1 = 0`);
      }
    } else {
      filterParts.push(`${layerName}:1 = 1`);
    }
  });

  return filterParts.join(';');
}

function updateLayer(layer, viewer, thematicOverride) {
  const styleName = layer.get('styleName');
  const style = viewer.getStyle(styleName);
  const thematicArr = thematicOverride || style?.[0]?.thematic;
  if (Array.isArray(thematicArr) && thematicArr.length > 0) {
    if (shouldSkipThematicRequests(layer, thematicArr)) {
      return;
    }

    if (layer.get('type') === 'GROUP') {
      const childLayers = layer.getLayers?.().getArray?.() || [];
      const thematicWmsChildren = childLayers.filter((childLayer) => childLayer.get('type') === 'WMS' && childLayer.get('thematicStyling') === true);

      // Single thematic WMS child in GROUP: treat thematic rows as class filters on that child.
      if (thematicWmsChildren.length === 1) {
        updateLayer(thematicWmsChildren[0], viewer, thematicArr);
        return;
      }

      // Multi thematic children in GROUP: thematic rows act as child-layer visibility toggles.
      const visibilityByLayer = {};

      const normalizeName = value => `${value || ''}`.trim().toLowerCase();
      const foldName = (value) => normalizeName(value)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9:]+/g, '');

      const findChildLayerName = (rawLayerName, { strictOnly = false } = {}) => {
        const candidate = normalizeName(rawLayerName);
        const foldedCandidate = foldName(rawLayerName);
        if (!candidate) {
          return null;
        }
        const matched = childLayers.find((childLayer) => {
          const childName = normalizeName(childLayer.get('name'));
          const childId = normalizeName(childLayer.get('id'));
          const childTitle = normalizeName(childLayer.get('title'));
          const foldedChildName = foldName(childLayer.get('name'));
          const foldedChildId = foldName(childLayer.get('id'));
          const foldedChildTitle = foldName(childLayer.get('title'));

          if (candidate === childName
            || candidate === childId
            || childName.endsWith(`:${candidate}`)
            || candidate.endsWith(`:${childName}`)
            || foldedCandidate === foldedChildName
            || foldedCandidate === foldedChildId) {
            return true;
          }

          if (strictOnly) {
            return false;
          }

          return candidate === childName
            || candidate === childTitle
            || foldedCandidate === foldedChildTitle;
        });
        return matched ? matched.get('name') : null;
      };

      thematicArr.forEach(theme => {
        // Prefer machine identifiers (_layerName/name) and only then fallback to human label/title.
        const layerName = findChildLayerName(theme._layerName, { strictOnly: true })
          || findChildLayerName(theme.name, { strictOnly: true })
          || findChildLayerName(theme._layerName)
          || findChildLayerName(theme.label)
          || findChildLayerName(theme.name);
        if (!layerName) {
          return;
        }
        if (typeof visibilityByLayer[layerName] === 'undefined') {
          visibilityByLayer[layerName] = false;
        }
        visibilityByLayer[layerName] = visibilityByLayer[layerName] || theme.visible !== false;
      });

      childLayers.forEach((childLayer) => {
        const childName = childLayer.get('name');
        if (Object.prototype.hasOwnProperty.call(visibilityByLayer, childName)) {
          childLayer.setVisible(visibilityByLayer[childName]);
        }
      });
      return;
    }
    const source = layer.getSource();
    const sourceType = getThematicWmsSourceType(layer, viewer);
    const isQgisWms = layer.get('type') === 'WMS' && sourceType === 'QGIS';
    // Check if any theme is not visible, otherwise remove filter
    const checkArr = obj => obj.visible === false;
    if (thematicArr.some(checkArr)) {
      if (isQgisWms) {
        const filterValue = buildQgisFilter(layer, thematicArr);
        source.updateParams({ FILTER: filterValue, CQL_FILTER: null });
      } else {
        let filterStr = '';
        thematicArr.forEach(theme => {
          if (theme.visible && theme.filter) {
            filterStr += filterStr === '' ? '' : ' OR ';
            filterStr += theme.filter;
          }
        });
        if (filterStr === '') {
          filterStr = "IN ('')";
        }
        source.updateParams({ CQL_FILTER: filterStr, FILTER: null });
      }
    } else {
      source.updateParams({ CQL_FILTER: null, FILTER: null });
    }
  }
}

const thematicPromises = new Map(); // against a possible race condition in a shared map
async function setIcon(src, cmp, styleRules, layer, viewer, clickable) {
  const styleName = layer.get('styleName');
  const style = viewer.getStyle(styleName);
  const activeThemes = layer.get('activeThemes');
  const hasThemeLegend = layer.get('hasThemeLegend');
  if (!style[0].thematic || style[0].thematic.length === 0) {
    if (!thematicPromises.has(styleName)) {
      const promise = (async () => {
        style[0].thematic = [];
        const sourceType = getThematicWmsSourceType(layer, viewer);
        const legendUrls = getThematicLegendUrls(src, sourceType, layer);
        const legendJsonUrl = legendUrls.json;
        const legendPngUrl = legendUrls.png;

        if (!legendJsonUrl) {
          viewer.setStyle(styleName, style);
          updateLayer(layer, viewer);
          return;
        }

        let jsonData;
        try {
          const response = await fetch(legendJsonUrl.toString());
          const contentType = response.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            jsonData = await response.json();
          } else {
            const body = await response.text();
            jsonData = JSON.parse(body);
          }
        } catch (error) {
          console.warn('Could not load thematic legend JSON', error);
          viewer.setStyle(styleName, style);
          updateLayer(layer, viewer);
          return;
        }

        if (jsonData.Legend && Array.isArray(jsonData.Legend[0]?.rules)) {
          // GeoServer: Legend[].rules
          jsonData.Legend[0].rules.forEach(row => {
            const ruleUrl = getLegendRequestUrl(src.icon.json, { FORMAT: 'image/png', RULE: row.name });
            const imgUrl = ruleUrl ? decodeURIComponent(ruleUrl.toString()) : '';
            if (typeof row.filter !== 'undefined') {
              style[0].thematic.push({
                image: { src: imgUrl },
                filter: row.filter,
                name: row.name,
                label: row.title || row.name,
                visible: row.visible !== false
              });
              if (activeThemes && hasThemeLegend) {
                const lastItem = style[0].thematic[style[0].thematic.length - 1];
                lastItem.visible = activeThemes.includes(row.name || row.title);
              }
            }
          });
        } else if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
          // QGIS Server: nodes[].symbols
          const collectSymbols = (nodes, parentLayerName = null, parentFilterExpr = null) => {
            const result = [];
            nodes.forEach(node => {
              // If this node has a name and looks like a layer (has symbols/children), use it as the layer context
              const currentLayerName = (node.name && (Array.isArray(node.symbols) || Array.isArray(node.children))) 
                ? node.name 
                : parentLayerName;
              const currentFilterExpr = node.filter || node.expression || parentFilterExpr;
              
              if (node.icon || node.rule || node.expression || node.filter) {
                // Attach layer name to symbol for filter building
                result.push({ ...node, _layerName: currentLayerName, _filterExpr: currentFilterExpr });
              }
              if (Array.isArray(node.symbols)) {
                node.symbols.forEach(symbol => {
                  result.push({ ...symbol, _layerName: currentLayerName, _filterExpr: symbol.filter || symbol.expression || currentFilterExpr });
                });
              }
              if (Array.isArray(node.nodes)) {
                result.push(...collectSymbols(node.nodes, currentLayerName, currentFilterExpr));
              }
              if (Array.isArray(node.children)) {
                result.push(...collectSymbols(node.children, currentLayerName, currentFilterExpr));
              }
            });
            return result;
          };

          const symbols = collectSymbols(jsonData.nodes);
          const getSafeFilterExpr = (symbol) => {
            const directExpr = symbol.filter || symbol.expression || symbol._filterExpr;
            if (directExpr && `${directExpr}`.trim() !== '') {
              return `${directExpr}`.trim();
            }
            if (typeof symbol.rule !== 'string') {
              return undefined;
            }
            const ruleExpr = symbol.rule.trim();
            if (!ruleExpr) {
              return undefined;
            }
            // Reject incomplete fragments such as "IS NULL" that are missing a field name.
            if (/^IS\s+(NOT\s+)?NULL$/i.test(ruleExpr)) {
              return undefined;
            }
            // Accept only expression-like rules.
            const isExpressionLike = /("[^"]+"|[A-Za-z_][A-Za-z0-9_\.]*)\s*(=|<>|!=|<=|>=|<|>|\bIN\b|\bLIKE\b|\bBETWEEN\b|\bIS\b)/i.test(ruleExpr);
            return isExpressionLike ? ruleExpr : undefined;
          };
          symbols.forEach(symbol => {
            // Only real expression fields should affect map filtering.
            // Keep legend rows even when a symbol has no filter expression.
            const filterExpr = getSafeFilterExpr(symbol);
            
            let imgSrc;
            if (symbol.icon) {
              // Pre-rendered base64 icon
              const raw = symbol.icon;
              if (raw.startsWith('data:')) {
                imgSrc = raw;
              } else if (raw.startsWith('base64,')) {
                imgSrc = `data:image/png;base64,${raw.slice(7)}`;
              } else if (/^[A-Za-z0-9+/]{64,}={0,2}$/.test(raw)) {
                imgSrc = `data:image/png;base64,${raw}`;
              } else {
                imgSrc = raw;
              }
            } else if (symbol.rule) {
              // Fallback only when no inline icon exists.
              const ruleUrl = getLegendRequestUrl(legendPngUrl ? legendPngUrl.toString() : src.icon.json, { RULE: symbol.rule });
              imgSrc = ruleUrl ? decodeURIComponent(ruleUrl.toString()) : '';
            }
            if (imgSrc) {
              const thematicItem = {
                image: { src: imgSrc },
                filter: filterExpr,
                name: symbol.rule || symbol.name || symbol.title || '',
                label: symbol.title || symbol.label || symbol.name || '',
                visible: symbol.visible !== false
              };
              // Preserve layer name for multi-layer filter building
              if (symbol._layerName) {
                thematicItem._layerName = symbol._layerName;
              }
              style[0].thematic.push(thematicItem);
              if (activeThemes && hasThemeLegend) {
                const lastItem = style[0].thematic[style[0].thematic.length - 1];
                lastItem.visible = activeThemes.includes(lastItem.name || lastItem.label);
              }
            }
          });
        }

        viewer.setStyle(styleName, style);
        updateLayer(layer, viewer);
      })();
      thematicPromises.set(styleName, promise);
    }
    await thematicPromises.get(styleName);
  }

  const cmps = [];

  for (let index = 0; index < style[0].thematic.length; index += 1) {
    const rule = style[0].thematic[index];
    let label = rule.label || '';
    const svgIcon = renderSvgIcon([rule], { opacity: 1 });
    const elCmps = [];
    if (layer) {
      const toggleButton = Button({
        cls: `round small icon-smaller no-shrink${clickable ? '' : ' cursor-default'}`,
        click() {
          if (clickable) {
            const visible = viewer.getStyles()[styleName][0].thematic[index].visible !== false;
            this.setIcon(!visible ? checkIcon : uncheckIcon);
            const thisStyle = viewer.getStyles()[styleName];
            thisStyle[0].thematic[index].visible = !visible;
            updateLayer(layer, viewer);
          }
        },
        style: {
          'align-self': 'center',
          'padding-left': '0rem'
        },
        icon: viewer.getStyles()[styleName][0].thematic[index].visible === false ? uncheckIcon : checkIcon,
        ariaLabel: 'Växla synlighet',
        tabIndex: -1
      });
      elCmps.push(toggleButton);
      label = `${label}`;
      elCmps.push(renderLegendItem(svgIcon, label, { styleName, index }));
      cmps.push(El({ components: elCmps, tagName: 'li', cls: 'flex row align-center padding-y-smallest' }));
    }
  }
  const newEl = El({ components: cmps, tagName: 'ul' });

  const contentEl = document.getElementById(cmp.getId());
  contentEl.innerHTML = newEl.render();
  newEl.onRender();
}

export const renderExtendedLegendItem = function renderExtendedLegendItem(extendedLegendItem) {
  return El({ innerHTML: `<img class="extendedlegend pointer" src=${extendedLegendItem.icon.src} />` });
};

export const renderExtendedThematicLegendItem = function renderExtendedThematicLegendItem(extendedLegendItem, styleRules, layer, viewer, clickable) {
  const returnCmp = El({
    tagName: 'ul'
  });
  returnCmp.on('render', () => { setIcon(extendedLegendItem, returnCmp, styleRules, layer, viewer, clickable); });

  return returnCmp;
};

export const Legend = function Legend({
  styleRules, layer, viewer, clickable = true, opacity = 1
} = {}) {
  const noLegend = 'Teckenförklaring saknas';
  if (Array.isArray(styleRules)) {
    const isGroupLayer = layer.get('type') === 'GROUP';
    const thematicTargetLayer = getThematicTargetLayer(layer);
    const thematicWmsChildren = isGroupLayer
      ? (layer.getLayers?.().getArray?.() || []).filter((childLayer) => childLayer.get('type') === 'WMS' && childLayer.get('thematicStyling') === true)
      : [];
    // Single thematic child GROUP should use child legend data (includes rule expressions).
    // Multi-child GROUP should use GROUP legend data for layer-level toggling.
    const thematicLegendLayer = (isGroupLayer && thematicWmsChildren.length !== 1) ? layer : thematicTargetLayer;
    let styleName;
    const layerType = thematicTargetLayer?.get('type') || layer.get('type');
    if (layer) {
      styleName = thematicLegendLayer?.get('styleName') || thematicTargetLayer?.get('styleName') || layer.get('styleName');
    }
    const thematicStyling = thematicLegendLayer?.get('thematicStyling') === true || thematicTargetLayer?.get('thematicStyling') === true;
    const activeThemes = thematicLegendLayer?.get('activeThemes') || thematicTargetLayer?.get('activeThemes') || layer.get('activeThemes');
    if (activeThemes) {
      const style = viewer.getStyles()[styleName];
      if (layerType !== 'WMS') {
        for (let i = 0; i < style.length; i += 1) {
          const combinedStr = style[i][0].id?.toString() || style[i][0].label?.toString();
          style[i][0].visible = activeThemes.includes(combinedStr);
        }
      }
    }
    let cmps = [];
    styleRules.forEach((rule, index) => {
      if (Array.isArray(rule)) {
        if (!isHidden(rule)) {
          const labelItem = rule.find(style => style.label) || {};
          const extendedLegendItem = rule.find(style => style.extendedLegend);
          const label = labelItem.label || '';
          const elCmps = [];
          if (extendedLegendItem && thematicStyling) {
            elCmps.push(renderExtendedThematicLegendItem(extendedLegendItem, styleRules, thematicLegendLayer, viewer, clickable));
            cmps = elCmps;
          } else if (extendedLegendItem && extendedLegendItem.icon) {
            elCmps.push(renderExtendedLegendItem(extendedLegendItem));
            cmps = elCmps;
          } else {
            if (thematicStyling && layerType !== 'WMS') {
              const toggleButton = Button({
                cls: `round small icon-smaller no-shrink${clickable ? '' : ' cursor-default'}`,
                click() {
                  if (clickable) {
                    const thisStyle = viewer.getStyles()[styleName];
                    const visible = thisStyle[index][0].visible !== false;
                    this.setIcon(!visible ? checkIcon : uncheckIcon);
                    thisStyle[index][0].visible = !visible;
                    layer.changed();
                  }
                },
                style: {
                  'align-self': 'center',
                  'padding-left': '0rem'
                },
                icon: viewer.getStyles()[styleName][index][0].visible === false ? uncheckIcon : checkIcon,
                ariaLabel: 'Växla synlighet',
                tabIndex: -1
              });
              elCmps.push(toggleButton);
            }
            const svgIcon = renderSvgIcon(rule, { opacity });
            elCmps.push(renderLegendItem(svgIcon, label, { styleName, index }));
            cmps.push(El({ components: elCmps, tagName: 'li', cls: 'flex row align-center padding-y-smallest' }));
          }
        }
      }
    });
    return El({ components: cmps, tagName: 'ul' });
  }
  const noLegendInner = El({ innerHTML: noLegend, tagName: 'li', cls: 'padding-smaller text-smaller' });
  const noLegendOuter = El({ components: [noLegendInner], tagName: 'ul' });
  return noLegendOuter;
};

export const HeaderIcon = function HeaderIcon(styleRules, opacity = 1) {
  if (Array.isArray(styleRules)) {
    const headerStyle = findHeaderStyle(styleRules);
    if (headerStyle) {
      return renderSvgIcon(headerStyle, { opacity, header: true });
    }
    return null;
  }
  return null;
};
