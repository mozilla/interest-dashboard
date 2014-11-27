function SpiderGraph($scope) {
  this.MAIN_RADIUS = 100;
  this.GENERIC_CIRCLE = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjxzdmcgdmlld0JveD0iMCAwIDUwMCA1MDAiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8ZGVmcz4KICAJPHJhZGlhbEdyYWRpZW50IGlkPSJncmFkMCIgcj0iMTAwJSIgY3k9IjAiIGN4PSIwIiBncmFkaWVudHVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+CiAgCQk8c3RvcCBzdHlsZT0ic3RvcC1jb2xvcjogIzRCQjBGRTsiIG9mZnNldD0iMCUiLz4KICAJCTxzdG9wIHN0eWxlPSJzdG9wLWNvbG9yOiAjMTc5M0U1OyIgb2Zmc2V0PSIxMDAlIi8+CiAgCTwvcmFkaWFsR3JhZGllbnQ+CiAgPC9kZWZzPgogIDxjaXJjbGUgY3g9IjI1MCIgY3k9IjI1MCIgcj0iMjQwIiBmaWxsPSJ1cmwoI2dyYWQwKSIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjgiLz4KPC9zdmc+Cgo=";
  this.YOU_CIRCLE = "data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIj8+Cjxzdmcgdmlld0JveD0iMCAwIDUwMCA1MDAiIHZlcnNpb249IjEuMSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8Y2lyY2xlIGN4PSIyNTAiIGN5PSIyNTAiIHI9IjI0MCIgZmlsbD0iI0YyRjJGMiIgc3Ryb2tlPSIjRkZGRkZGIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+";
  this.colors = d3.scale.category20();
  this._nodeList = {};

  this._init();
  this.force = d3.layout.force()
    .size([this.width, this.height])
    .linkDistance(function(node, index) {
      let distance = 150 + node.target.layer * 100;
      return distance;
    })
    .charge(-8000)
    .on("tick", () => { this._tick(); });
}

SpiderGraph.prototype = {
  _init: function() {
    let self = this;
    this.width  = $(window).width();
    this.height = $(window).height() - 50;

    let x = d3.scale.linear()
        .domain([-this.width / 2, this.width / 2])
        .range([0, this.width]);

    let y = d3.scale.linear()
        .domain([-this.height / 2, this.height / 2])
        .range([this.height, 0]);

    function zoomed() {
      self._graphContainer.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
    }
    function stopped() {
      if (d3.event.defaultPrevented) d3.event.stopPropagation();
    }
    this.zoom = d3.behavior.zoom()
      .x(x)
      .y(y)
      .scaleExtent([1, 10])
      .on("zoom", zoomed);

    this.svg = d3.select("#spiderGraph svg")
      .append("g")
      .on("click", stopped, true)
      .call(this.zoom);
    this.svg.append("rect")
      .attr("width", this.width)
      .attr("height", this.height);

    this._graphContainer = this.svg.append("g");
    this._graphContainer.append("g").attr("class", "links");
    this._graphContainer.append("g").attr("class", "nodes");
  },

  _tick: function() {
    link.attr("x1", (d) => { return d.source.x; })
        .attr("y1", (d) => { return d.source.y; })
        .attr("x2", (d) => { return d.target.x; })
        .attr("y2", (d) => { return d.target.y; });

    node.attr("transform", (d) => {
      return "translate(" + d.x + "," + d.y + ")";
    });
  },

  _createNodeList: function() {
    this._nodeList = {};
    for (let i in this._links) {
      let link = this._links[i];
      if (!this._nodeList[link.source]) {
        this._nodeList[link.source] = {"children": []};
      }
      this._nodeList[link.source].children.push(link.target);
    }
  },

  _click: function(d) {
    let scale = .9 / Math.max(d.radius*2 / this.width, d.radius*2 / this.height);
    let translate = [this.width / 2 - scale * d.x, this.height / 2 - scale * d.y];

    this.svg.transition()
      .duration(750)
      .call(this.zoom.translate(translate).scale(scale).event);
  },

  _addChild: function(nodeID, parentID) {
    this._nodes.push(this._originalNodes[nodeID]);

    let parent = this._nodes.length - 1;
    this._links.push({"source": parentID, "target": parent});

    if (this._nodeList[nodeID] && this._nodeList[nodeID].children) {
      for (let childIndex in this._nodeList[nodeID].children) {
        let childID = this._originalNodes[this._nodeList[nodeID].children[childIndex]].id;
        this._addChild(childID, parent);
      }
    }
  },

  _hideSecondLevelChildren: function() {
    if (this._nodeList && this._nodeList["0"]) {
      for (let childID of this._nodeList["0"]["children"]) {
        this._nodeList[childID]._children = this._nodeList[childID].children;
        this._nodeList[childID].children = null;
      }
    }
  },

  _recomputeNodes: function() {
    this._links = [];
    this._nodes = [];
    this._addChild(0, 0);
  },

  _getHTMLForNode: function(node) {
    if (node.name == "YOU") {
      function daysPostEpochToDate(dayCount) {
        return parseInt(dayCount) * 24 * 60 * 60 * 1000;
      }

      let minDate = d3.time.format('%m/%d/%Y')(new Date(daysPostEpochToDate(node.minDay)));
      return '<div class="centerNode">' +
          '<p id="totalInterests">' + node.numInterests + '</p>' +
          '<p id="activeInterestsLabel">Active Interests</p>' +
          '<p id="startDate">since ' + minDate + '</p>' +
        '</div>';
    }
    return '<p class="nodeText">' + node.name + '</p>';
  },

  _getFontSizeByRadius: function(radius) {
    switch(radius) {
      case 50:
        return "12px";
      case 60:
        return "16px";
      case 70:
        return "18px";
      case 95:
        return "22px"
      case 110:
        return "28px";
    }
  },

  graph: function(data, table, $scope) {
    if (data) {
      d3.select("#spiderGraph svg").selectAll("*").remove();
      this._init();

      data.nodes[0].x = this.width / 2;
      data.nodes[0].y = this.height / 2;

      this._originalNodes = data.nodes;
      this._links = data.links;
      this._createNodeList();
      this._hideSecondLevelChildren();
      this._recomputeNodes();
    }
    this.force
      .nodes(this._nodes)
      .links(this._links)

    link = this.svg.select(".links").selectAll(".link")
    link = link.data(this._links);
    link.exit().remove();
    link.enter().append("line")
      .attr("class", "link");

    node = this.svg.select(".nodes").selectAll(".node");
    node = node.data(this._nodes, function(d) { return  d.id; });
    node.exit().remove();
    node.enter().append("g")
      .attr("class", "node")
      .on("click", (d) => { return this._click(d); });

    node.append("svg:image")
      .attr("xlink:href", (d) => { return d.name == "YOU" ? this.YOU_CIRCLE : this.GENERIC_CIRCLE; })
      .attr("width", function(d) { return d.radius * 2; })
      .attr("height", function(d) { return d.radius * 2; })
      .attr("x", function(d) { return -d.radius; })
      .attr("y", function(d) { return -d.radius; });

    this.force.start();
    this.force.tick();

    node.append("foreignObject")
      .attr("width", function(d) { return d.radius * 2 - 35; })
      .attr("height", function(d) { return d.radius * 2 - 35; })
      .attr("x", function(d) { return -d.radius + 17.5; })
      .attr("y", function(d) { return -d.radius + 17.5; })
      .append("xhtml:body")
        .style("font-size", (d) => {
          return this._getFontSizeByRadius(d.radius);
        })
        .style("background-color", "transparent")
        .attr("width", 30)
        .html((d) => { return this._getHTMLForNode(d); });

    this.force.start();
    if (data) {
      // Wait for graph to settle down before displaying on first draw.
      for (var i = 0; i < 100; ++i) this.force.tick();
    }
  }
}
