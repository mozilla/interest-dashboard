function SpiderGraph($scope) {
  this.MAIN_RADIUS = 100;
  this.colors = d3.scale.category20();
  this._nodeList = {};

  this.force = d3.layout.force()
    .charge(-6000)
    .gravity(0.001)
    .on("tick", () => {
      console.log("CALLING TICK");
      this._tick();
    });

  this._init();
}

SpiderGraph.prototype = {
  _init: function() {
    this.svg = d3.select("#spiderGraph svg");
    this.width  = this.svg.attr("width");
    this.height = this.svg.attr("height");
    this.svg.append("rect")
      .attr("width", this.width)
      .attr("height", this.height);

    this.svg.append("g").attr("class", "links");
    this.svg.append("g").attr("class", "nodes");
  },

  _tick: function() {
    link.attr("x1", (d) => { return (Math.max(d.source.radius, Math.min(this.width - d.source.radius, d.source.x))); })
        .attr("y1", (d) => { return (Math.max(d.source.radius, Math.min(this.height - d.source.radius, d.source.y))); })
        .attr("x2", (d) => { return (Math.max(d.target.radius, Math.min(this.width - d.target.radius, d.target.x))); })
        .attr("y2", (d) => { return (Math.max(d.target.radius, Math.min(this.height - d.target.radius, d.target.y))); });

    node.attr("transform", (d) => {
      let thing = (Math.max(d.radius, Math.min(this.width - d.radius, d.x))) + "," + (Math.max(d.radius, Math.min(this.height - d.radius, d.y)));
      console.log("WE WILL TRANSLATE TO THIS " + thing);
      return "translate(" + (Math.max(d.radius, Math.min(this.width - d.radius, d.x))) + "," + (Math.max(d.radius, Math.min(this.height - d.radius, d.y))) + ")";
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
    if (d3.event.defaultPrevented) return; // click suppressed

    if (!this._nodeList[d.id]) {
      return; // leaf nodes.
    }
    if (this._nodeList[d.id].children) {
      this._nodeList[d.id]._children = this._nodeList[d.id].children;
      this._nodeList[d.id].children = null;
    } else {
      this._nodeList[d.id].children = this._nodeList[d.id]._children;
      this._nodeList[d.id]._children = null;
    }
    this._recomputeNodes();
    this.graph();
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

  graph: function(data, table, $scope) {
    console.log("DATA " +  JSON.stringify(data));
    try {
    if (data) {
      d3.select("#spiderGraph svg").selectAll("*").remove();
      this._init();

      console.log("SETTING X AND Y, width is " + this.width);
      data.nodes[0].x = this.width / 2 - this.MAIN_RADIUS / 2;
      data.nodes[0].y = this.height / 2 - this.MAIN_RADIUS / 2;

      this._originalNodes = data.nodes;
      this._links = data.links;
      this._createNodeList();
      this._hideSecondLevelChildren();
      this._recomputeNodes();
    }
    console.log("NODES " + JSON.stringify(this._nodes));
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
      .on("click", (d) => { return this._click(d); })
      .call(this.force.drag);

    node.append("circle")
      .attr("class", "node")
      .attr("r", function(d) { return d.radius; } )
      .style('fill', (d) => { return this.colors(d.id); })

    this.force.start();
    this.force.tick();

    node.append("text")
      .text(function(d) { return d.name; })
      .style("font-size", "50px");

    this.force.start();
    console.log("how do we not get here???");
    if (data) {
      // Wait for graph to settle down before displaying on first draw.
      console.log("about to call tick");
      for (var i = 0; i < 100; ++i) this.force.tick();
      //this.force.stop();
    }
    } catch(ex) {
      console.log("WTF  " + ex);
    }
  }
}
