var chartsById = {};
chartsById[graphExporter.xicChartId] = null;
chartsById[graphExporter.massPeakChartId] = null;

var imageFormats = graphExporter.supportedImageFormatIds;
var dataFormats = graphExporter.supportedDataFormatIds;

var auxPointFlag = 'aux_data';
var graphTitleKey = 'title';
var graphXFieldKey = 'xField';
var graphYFieldKey = 'yField';
var graphColorKey = 'lineColor';

var actualPlotData = {};

var graphColors = {
    _colorGenerationSize: 10,
    // default amCharts colors
    _colors: ['#FF6600', '#FCD202', '#B0DE09', '#0D8ECF', '#2A0CD0', '#CD0D74', '#CC0000', '#00CC00', '#0000CC', '#DDDDDD', '#999999', '#333333', '#990000'],
    getColor: function(number) {
        if (number >= this._colors.length) {
            this._colors = this._colors.concat(randomColor({count: number - this._colors.length + 1 + this._colorGenerationSize}));
        }
        if (number >= this._colors.length) {
            throw 'Internal error: failed to generate new graph colors';
        }
        return this._colors[number];
    }
};

function clone(obj) {
    if (null == obj || 'object' != typeof obj) return obj;
    var copy = obj.constructor();
    for (var attr in obj) {
        copy[attr] = obj[attr];
    }
    return copy;
}

function getCoordinates(chartId) {
    var chart = chartsById[chartId];
    var graphDescriptorsKey = chartId === graphExporter.xicChartId ? dataController.xicGraphDescKey :
        xicGraphSelectionState._selectionActive ? dataController.msnGraphDescKey : dataController.ms1GraphDescKey;
    var graphDescriptors = actualPlotData[graphDescriptorsKey];

    var resultPoints = [];
    for (var i = 0; i < chart.dataProvider.length; ++i) {
        var originalPoint = chart.dataProvider[i];
        var currentGraph = chart.getGraphById(originalPoint[dataController.graphIdKey]);
        var resultPoint = {};
        if (auxPointFlag in originalPoint || currentGraph.hidden) {
            continue;
        }

        var graphId = originalPoint[dataController.graphIdKey];

        var xKey = graphDescriptors[graphId][dataController.xFieldKey];
        resultPoint['x'] = originalPoint[xKey];

        var yKey = graphDescriptors[graphId][dataController.yFieldKey];
        var graphName = currentGraph[graphTitleKey].replace('<br>', '; ');
        resultPoint['y'] = graphName;
        resultPoint[graphName] = originalPoint[yKey];

        resultPoints.push(resultPoint);
    }
    return resultPoints;
}

function generateFormatListMenu(chartId, formats) {
    var menuItems = [];
    for (var i = 0; i < formats.length; ++i) {
        var formatId = formats[i];
        var menuItem = {
            'label': formatId,
            'click': function (event, menuItem) {
                var chart = chartsById[chartId];

                // seems that chart.chartCursor.enabled property doesn't work so we play with alpha of cursor
                // TODO: check the property with future versions of amCharts
                var cursorAlpha = chart.chartCursor.cursorAlpha;
                chart.chartCursor.cursorAlpha = 0;
                var zoomButtonImage = chart.zoomOutButtonImage;
                chart.zoomOutButtonImage = '';
                var zoomButtonText = chart.zoomOutText;
                chart.zoomOutText = '';
                chart.chartCursor.valueLineBalloonEnabled = false;

                chart.chartScrollbar.enabled = false;
                chart.validateData();

                graphExporter.exportGraph(chartId, menuItem.label, getCoordinates(chartId));

                chart.chartScrollbar.enabled = true;
                chart.chartCursor.cursorAlpha = cursorAlpha;
                chart.zoomOutButtonImage = zoomButtonImage;
                chart.zoomOutText = zoomButtonText;
                chart.chartCursor.valueLineBalloonEnabled = true;
                chart.validateData();
            }
        };
        menuItems.push(menuItem);
    }
    return menuItems;
}

function generatePlotExportDescriptor(graphId) {
    return {
        'enabled': true,
        'menu': [{
            'class': 'export-main',
            'menu': [{
                'label': 'Save image...',
                'menu': generateFormatListMenu(graphId, imageFormats)
            }, {
                'label': 'Save plot data...',
                'menu': generateFormatListMenu(graphId, dataFormats)
            }]
        }]
    };
}

function generatePlotScrollbarDescriptor() {
    return {
        'dragIconHeight': 20
    };
}

// Source: http://stackoverflow.com/questions/11832914/round-to-at-most-2-decimal-places-in-javascript#answer-19722641
Number.prototype.round = function (places) {
    return +(Math.round(this + 'e+' + places) + 'e-' + places);
}

function generateXicGraphProto() {
    return {
        'balloonFunction': adjustXicBalloonText,
        'bulletField': 'bullet',
        'bulletBorderAlpha': 1,
        'colorField': 'color',
        'bulletSizeField': 'bulletSize',
        'fillAlphas': 0.7,
        'hideBulletsCount': 1000
    };
}

function adjustXicBalloonText(graphDataItem, graph) {
    var hasPrecursorMz = dataController.precursorMzKey in graph.chart.dataProvider[graphDataItem.index];
    return (hasPrecursorMz ? ('Precursor m/z: ' + graph.chart.dataProvider[graphDataItem.index][dataController.precursorMzKey].round(4)
        + '<br>(Click to see MS/MS spectrum)<br>') : '')
        + '<b><span style="font-size:14px;">Scan start time:' + graphDataItem.values.x.round(2) + ' s</span></b>';
}

function generateMassGraphProto() {
    return {
        'balloonFunction': adjustMassPeakBalloonText,
        'lineAlpha': 1,
        'fillAlphas': 1,
        'bulletField': 'bullet',
        'bulletSizeField': 'bulletSize',
        'bulletBorderAlpha': 1,
        'useLineColorForBulletBorder': true,
        'hideBulletsCount': 1000
    };
}

function adjustMassPeakBalloonText(graphDataItem, graph) {
    return '<b><span style="font-size:14px;">m/z:' + graphDataItem.values.x.round(4) + '</span></b>';
}

function xicPointAttributeSetter(point) {
    if (dataController.precursorMzKey in point) {
        point['bullet'] = 'round';
        point['color'] = '#B22222';
        point['bulletSize'] = 10;
        point[auxPointFlag] = true;
    }
}

function massPointAttributeSetter(point) {
    point['bullet'] = 'round';
    point['bulletSize'] = 0.5;
}

function createAuxGroundPoint(point, valueAxisKey, categoryAxisKey, categoryOffset) {
    var auxPoint = clone(point);
    auxPoint[categoryAxisKey] += categoryOffset;
    auxPoint[valueAxisKey] = 0.0;
    auxPoint[auxPointFlag] = true;
    return auxPoint;
}

function isAuxPoint(point) {
    return auxPointFlag in point;
}

function getGraphs(graphDescriptors, points, graphProtoGenerator, horizontalOffset, stickPlot, pointAttributeSetter) {
    var graphs = [];

    if (!graphDescriptors || !points) {
        return graphs;
    }

    var lastGraphId = null;
    for (var i = 0; i < points.length; ++i) {
        var curPoint = points[i];
        var curGraphId = curPoint[dataController.graphIdKey];
        var curGraphDescriptor = graphDescriptors[curGraphId];

        if (isAuxPoint(curPoint)) {
            continue;
        }

        // add auxilary ground points at ends of current graph
        var addAuxBefore = stickPlot || curGraphId !== lastGraphId;
        var addAuxAfter = stickPlot || i === points.length - 1;

        var addOffsetBefore = horizontalOffset > 0 && curGraphId !== lastGraphId;
        var addOffsetAfter = horizontalOffset > 0 && i === points.length - 1;

        if (curGraphId !== lastGraphId) {
            var currentGraph = graphProtoGenerator();
            currentGraph[graphXFieldKey] = curGraphDescriptor[dataController.xFieldKey];
            currentGraph[graphYFieldKey] = curGraphDescriptor[dataController.yFieldKey];
            currentGraph[graphTitleKey] = 'Sample: ' + curGraphDescriptor[dataController.sampleNameGraphKey];
            if (dataController.scanIdKey in curGraphDescriptor) {
                currentGraph[graphTitleKey] += '<br>Scan ID: ' + curGraphDescriptor[dataController.scanIdKey];
            } else if (dataController.consensusMzGraphKey in curGraphDescriptor) {
                currentGraph[graphTitleKey] += '<br>Consensus m/z: ' + curGraphDescriptor[dataController.consensusMzGraphKey].round(4);
            }
            currentGraph[graphColorKey] = graphColorKey in curGraphDescriptor ? curGraphDescriptor[graphColorKey] : graphColors.getColor(graphs.length);
            currentGraph['id'] = curGraphId;
            graphs.push(currentGraph);
            lastGraphId = curGraphId;
        }

        var xField = curGraphDescriptor[dataController.xFieldKey];
        var yField = curGraphDescriptor[dataController.yFieldKey];
        if (addOffsetBefore) {
            points.splice(i++, 0, createAuxGroundPoint(curPoint, yField, xField, -horizontalOffset));
        }
        if (addAuxBefore && (i === 0 || !(isAuxPoint(points[i - 1]) && points[i - 1][xField] === curPoint[xField]))) {
            points.splice(i++, 0, createAuxGroundPoint(curPoint, yField, xField, 0));
        }
        if (addAuxAfter && (i === points.length - 1 || !(isAuxPoint(points[i + 1]) && points[i + 1][xField] === curPoint[xField]))) {
            points.splice(++i, 0, createAuxGroundPoint(curPoint, yField, xField, 0));
        }
        if (addOffsetAfter) {
            points.splice(++i, 0, createAuxGroundPoint(curPoint, yField, xField, horizontalOffset));
        }
        pointAttributeSetter(curPoint);
    }
    return graphs;
}

var xicGraphSelectionState = {
    _selectedItems: [],
    _selectedCharts: [],
    _alphasByGraph: [],
    _selectionActive: false,
    _lastUsedColorIndex: -1,

    reset: function() {
        this._selectedItems = [];
        this._selectedCharts = [];
        this._alphasByGraph = [];
        this._lastUsedColorIndex = -1;
        this._selectionActive = false;
    },

    deselect: function(event) {
        if (this._selectionActive) {
            for (var i = 0; i < this._alphasByGraph.length; ++i) {
                this._alphasByGraph[i]['graph'].fillAlphas = this._alphasByGraph[i]['fillAlphas'];
                this._alphasByGraph[i]['graph'].lineAlpha = this._alphasByGraph[i]['lineAlpha'];
            }
            this._alphasByGraph = [];
            for (var i = 0; i < this._selectedItems.length; ++i) {
                this._selectedItems[i]['item'].dataContext[this._selectedItems[i]['colorField']] = this._selectedItems[i]['previousColor'];
            }
            this._selectedItems = [];

            for (var i = 0; i < this._selectedCharts.length; ++i) {
                this._selectedCharts[i].validateData();
            }
            this._selectedCharts = [];
            this._selectionActive = false;
            this._lastUsedColorIndex = -1;

            delete actualPlotData[dataController.msnGraphDescKey];
            delete actualPlotData[dataController.msnGraphDataKey];

            updateMassChartData(actualPlotData[dataController.ms1GraphDescKey], actualPlotData[dataController.ms1GraphDataKey], false);
        }
    },

    select: function (event) {
        event.event.stopPropagation();

        if (!event.event.ctrlKey) {
            this.deselect(event.event);
        }
        var isMs2ScanClicked = dataController.precursorMzKey in event.graph.chart.dataProvider[event.item.index];
        if (!isMs2ScanClicked) {
            return;
        }

        if (event.event.ctrlKey) {
            for (var i = 0; i < this._selectedItems.length; ++i) {
                if (this._selectedItems[i]['item'].values.x == event.item.values.x
                    && this._selectedItems[i]['item'].values.y == event.item.values.y)
                {
                    if (this._selectedItems.length == 1) {
                        this.deselect(event.event);
                        return;
                    } else {
                        this._selectedItems[i]['item'].dataContext[this._selectedItems[i]['colorField']] = this._selectedItems[i]['previousColor'];
                        this._selectedItems.splice(i, 1);
                        event.chart.validateData();
                        this._updateMs2Spectra();
                        return;
                    }
                }
            }
        }

        this._selectedItems.push({
            'item': event.item,
            'colorField': event.graph.colorField,
            'previousColor': event.item.dataContext[event.graph.colorField]
        });

        if (-1 == this._selectedCharts.indexOf(event.chart)) {
            this._selectedCharts.push(event.chart);

            this._alphasByGraph = [];
            for (var i = 0; i < event.chart.graphs.length; ++i) {
                this._alphasByGraph.push({
                    'graph': event.chart.graphs[i],
                    'fillAlphas': event.chart.graphs[i]['fillAlphas'],
                    'lineAlpha': event.chart.graphs[i]['lineAlpha']
                });
                event.chart.graphs[i].fillAlphas = 0.3;
                event.chart.graphs[i].lineAlpha = 0.3;
            }

            this._selectionActive = true;
        }
        // color of selected ms2 scan point is the same as color of ms2 spectrum graph
        event.item.dataContext[event.graph.colorField] = graphColors.getColor(++this._lastUsedColorIndex);
        event.chart.validateData();

        this._updateMs2Spectra();
    },

    _updateMs2Spectra: function() {
        var spectraIds = this._selectedItems.map(function(item) {
            return item.item.dataContext[dataController.spectrumIdKey];
        });
        var graphData = dataController.getMs2Spectra(spectraIds);
        var graphDescriptors = graphData[dataController.msnGraphDescKey];
        for (var graphId in graphDescriptors) {
            var xicPoint = null;
            var xicPointColor = '';
            for (var i = 0; i < this._selectedItems.length; ++i) {
                if (this._selectedItems[i].item.dataContext[dataController.spectrumIdKey] == graphId) {
                    xicPoint = this._selectedItems[i].item.dataContext;
                    xicPointColor = xicPoint[this._selectedItems[i]['colorField']];
                    break;
                }
            }
            if (null === xicPoint) {
                throw 'Failed to find XIC point with fragmentation spectrum ID ' + graphId;
            }

            graphDescriptors[graphId][dataController.scanIdKey] = xicPoint[dataController.scanIdKey];
            graphDescriptors[graphId][dataController.sampleNameGraphKey]
                = actualPlotData[dataController.xicGraphDescKey][xicPoint[dataController.graphIdKey]][dataController.sampleNameGraphKey];
            graphDescriptors[graphId][graphColorKey] = xicPointColor;
        }
        actualPlotData[dataController.msnGraphDescKey] = graphDescriptors;
        actualPlotData[dataController.msnGraphDataKey] = graphData[dataController.msnGraphDataKey];
        updateMassChartData(graphDescriptors, graphData[dataController.msnGraphDataKey], true);
    }
};

function createXicGuides(graphs, graphDescriptors) {
    var guides = [];
    for (var i = 0; i < graphs.length; ++i) {
        var descriptor = graphDescriptors[graphs[i]['id']];
        guides.push({
            value: descriptor[dataController.featureStartGraphKey],
            toValue: descriptor[dataController.featureEndGraphKey],
            above: false,
            lineAlpha: 1,
            fillAlpha: 0.1,
            dashLength: 10,
            fillColor: graphColors.getColor(i),
            lineColor: graphColors.getColor(i)
        });
    }
    return guides;
}

function getCountOfVisibleGraphs(chart) {
    var visibleCount = 0;
    for (var i = 0; i < chart.graphs.length; ++i) {
        if (!chart.graphs[i].hidden) {
            visibleCount++;
        }
    }
    return visibleCount;
}

function handleXicLegendClick(graph) {
    var chart = graph.chart;
    var actionHide = !graph.hidden;
    if (actionHide && getCountOfVisibleGraphs(chart) < 2) {
        return false;
    }

    var graphIndex = chart.graphs.indexOf(graph);
    if (-1 === graphIndex) {
        throw 'Internal error: couldn\'t find graph in chart';
    }

    for (var chartId in chartsById) {
        var curChart = chartsById[chartId];
        if (curChart == chart) {
            var chartGuides = curChart['valueAxes'][0]['guides'];
            if (actionHide) {
                curChart.hideGraph(graph);
                chartGuides[graphIndex].lineAlpha = 0;
                chartGuides[graphIndex].fillAlpha = 0;
            } else {
                curChart.showGraph(graph);
                chartGuides[graphIndex].lineAlpha = 1;
                chartGuides[graphIndex].fillAlpha = 0.1;
            }
            curChart.validateData();
        } else if (!xicGraphSelectionState._selectionActive) {
            if (actionHide) {
                curChart.hideGraph(curChart.graphs[graphIndex]);
            } else {
                curChart.showGraph(curChart.graphs[graphIndex]);
            }
        }
    }
    return false;
}

var legendHoverState = {
    _graphPrevAlphas: [],
    _affectedCharts: [],

    rollOver: function(graph) {
        var charts = [chartsById[graphExporter.xicChartId]];
        if (!xicGraphSelectionState._selectionActive) {
            charts.push(chartsById[graphExporter.massPeakChartId]);
        }
        for (var c = 0; c < charts.length; ++c) {
            for (var i = 0; i < charts[c].graphs.length; ++i) {
                var curGraph = charts[c].graphs[i];
                this._graphPrevAlphas.push({
                    'graph': curGraph,
                    'fillAlphas': curGraph['fillAlphas'],
                    'lineAlpha': curGraph['lineAlpha'],
                    'bulletAlpha': curGraph['bulletAlpha'],
                    'bulletBorderAlpha': curGraph['bulletBorderAlpha']
                });
                if (curGraph[graphTitleKey] != graph[graphTitleKey]) {
                    curGraph.fillAlphas = 0.1;
                    curGraph.lineAlpha = 0.1;
                    curGraph.bulletAlpha = 0.1;
                    curGraph.bulletBorderAlpha = 0.1;
                } else {
                    curGraph.fillAlphas = 1;
                    curGraph.lineAlpha = 1;
                    curGraph.bulletAlpha = 1;
                    curGraph.bulletBorderAlpha = 1;
                }
            }
            this._affectedCharts.push(charts[c]);
            charts[c].validateData();
        }
    },
    rollOut: function() {
        for (var i = 0; i < this._graphPrevAlphas.length; ++i) {
            this._graphPrevAlphas[i]['graph'].fillAlphas = this._graphPrevAlphas[i]['fillAlphas'];
            this._graphPrevAlphas[i]['graph'].lineAlpha = this._graphPrevAlphas[i]['lineAlpha'];
            this._graphPrevAlphas[i]['graph'].bulletAlpha = this._graphPrevAlphas[i]['bulletAlpha'];
            this._graphPrevAlphas[i]['graph'].bulletBorderAlpha = this._graphPrevAlphas[i]['bulletBorderAlpha'];
        }
        this._graphPrevAlphas = [];
        for (var c = 0; c < this._affectedCharts.length; ++c) {
            this._affectedCharts[c].validateData();
        }
        this._affectedCharts = [];
    }
};

function createXicChart(div_id, dataProvider, graphs, guides) {
    var result = AmCharts.makeChart(div_id, {
        'type': 'xy',
        'theme': 'light',
        'autoMarginOffset': 20,
        'startDuration': 0.1,
        'dataProvider': dataProvider,
        'graphs': graphs,
        'maxZoomFactor': 10000,
        'legend': {
            'divId': 'legend_container',
            'align': 'center',
            'switchable': graphs.length > 1,
            'clickMarker': handleXicLegendClick,
            'clickLabel': handleXicLegendClick /*,
            TODO: come up with a better implementation of graph highlighting
            'listeners': [{
                'event': 'rollOverItem',
                'method': function (event) {
                    legendHoverState.rollOver(event.chart.graphs[event.dataItem.index]);
                }
            }, {
                'event': 'rollOutItem',
                'method': function (event) {
                    legendHoverState.rollOut();
                }
            }]*/
        },
        'valueAxes': [{
            'id': 'x',
            'position': 'bottom',
            'dashLength': 1,
            'title': 'Retention time [s]',
            'guides': guides
        }, {
            'id': 'y',
            'dashLength': 1,
            'position': 'left',
            'title': 'Intensity [number of ions]'
        }],
        'chartScrollbar': generatePlotScrollbarDescriptor(),
        'chartCursor': {
            'valueLineAxis': 'y',
            'valueLineBalloonEnabled': true
        },
        'marginLeft': 60,
        'marginBottom': 60,
        'marginRight': 60,
        'export': generatePlotExportDescriptor(graphExporter.xicChartId),
        'responsive': {
            'enabled': true
        },
        'listeners': [{
            'event': 'clickGraphItem',
            'method': function(event) {
                xicGraphSelectionState.select(event);
            }
        }]
    });
    return result;
}

function isMouseOverZoomButton(event) {
    var zoomOutButton = this.querySelector('.amcharts-zoom-out-bg');
    if (zoomOutButton) {
        var rect = zoomOutButton.getBoundingClientRect();
        var x = event.clientX;
        var y = event.clientY;
        return !(x < rect.left || x >= rect.left + rect.width || y < rect.top || y >= rect.top + rect.height);
    } else {
        return false;
    }
}

document.getElementById('xic_container').addEventListener('click', function (event) {
    if (!isMouseOverZoomButton.bind(this)(event)) {
        xicGraphSelectionState.deselect(event);
    }
});

function handleMassPeakLegendClick(graph) {
    var chart = graph.chart;
    var actionHide = !graph.hidden;
    if (actionHide && getCountOfVisibleGraphs(chart) < 2) {
        return false;
    }
    if (actionHide) {
        chart.hideGraph(graph);
    } else {
        chart.showGraph(graph);
    }
    return false;
}

function createMassPeakChart(div_id, dataProvider, graphs, createSeparateLegend) {
    var result = AmCharts.makeChart(div_id, {
        'type': 'xy',
        'marginLeft': 60,
        'marginBottom': 60,
        'marginRight': 60,
        'autoMarginOffset': 20,
        'startDuration': 0.1,
        'dataProvider': dataProvider,
        'graphs': graphs,
        'maxZoomFactor': 10000,
        'chartScrollbar': generatePlotScrollbarDescriptor(),
        'chartCursor': {
            'valueLineAxis': 'y',
            'valueLineBalloonEnabled': true,
        },
        'legend': {
            'enabled': createSeparateLegend,
            'switchable': graphs.length > 1,
            'clickMarker': handleMassPeakLegendClick,
            'clickLabel': handleMassPeakLegendClick
        },
        'valueAxes': [{
            'id': 'x',
            'position': 'bottom',
            'dashLength': 1,
            'title': 'm/z'
        }, {
            'id': 'y',
            'dashLength': 1,
            'position': 'left',
            'title': 'Intensity [number of ions]'
        }],
        'export': generatePlotExportDescriptor(graphExporter.massPeakChartId),
        'responsive': {
            'enabled': true
        }
    });
    if (!createSeparateLegend) { // sync hidden graphs
        var xicGraphs = chartsById[graphExporter.xicChartId].graphs;
        var massPeakGraphs = result.graphs;
        if (xicGraphSelectionState._selectionActive) {
            return;
        }
        for (var i = 0; i < xicGraphs.length; ++i) {
            if (xicGraphs[i].hidden) {
                result.hideGraph(massPeakGraphs[i]);
            }
        }
    }
    return result;
}

function updateMassChartData(graphDescriptors, points, createSeparateLegend) {
    var massGraphs = getGraphs(graphDescriptors, points, generateMassGraphProto, 0.5, true, massPointAttributeSetter);

    var massPeakChart = chartsById[graphExporter.massPeakChartId];
    if (null !== massPeakChart) {
        massPeakChart.clear();
    }

    chartsById[graphExporter.massPeakChartId] = createMassPeakChart('mass_peak_container', points, massGraphs, createSeparateLegend);
}

function updateChartData(data) {
    xicGraphSelectionState.reset();
    actualPlotData = data;

    var xicGraphs = getGraphs(data[dataController.xicGraphDescKey], data[dataController.xicGraphDataKey], generateXicGraphProto, 0, false, xicPointAttributeSetter);

    var xicChart = chartsById[graphExporter.xicChartId];
    if (null !== xicChart) {
        xicChart.clear();
    }
    chartsById[graphExporter.xicChartId] = createXicChart('xic_container', data[dataController.xicGraphDataKey], xicGraphs, createXicGuides(xicGraphs, data[dataController.xicGraphDescKey]));

    updateMassChartData(data[dataController.ms1GraphDescKey], data[dataController.ms1GraphDataKey], false);
}

dataController.updatePlot.connect(this, updateChartData);
