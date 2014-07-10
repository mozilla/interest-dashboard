function SpiderGraph() {
  this.svg = d3.select("#spiderGraph svg");
  this.width  = this.svg.attr("width");
  this.height = this.svg.attr("height");
  this.MAIN_RADIUS = 100;
  this.LINK_LENGTH = 0;
  this.colors = d3.scale.category20();

  this.force = d3.layout.force()
    .charge(-6000)
    .gravity(0.001)
    .on("tick", () => { this._tick(); });

  this.svg.append("rect")
    .attr("width", this.width)
    .attr("height", this.height);

  this.svg.append("g").attr("class", "links");
  this.svg.append("g").attr("class", "nodes");
}

SpiderGraph.prototype = {
  _tick: function() {
    link.attr("x1", (d) => { return (Math.max(d.source.radius, Math.min(this.width - d.source.radius, d.source.x))); })
        .attr("y1", (d) => { return (Math.max(d.source.radius, Math.min(this.height - d.source.radius, d.source.y))); })
        .attr("x2", (d) => { return (Math.max(d.target.radius, Math.min(this.width - d.target.radius, d.target.x))); })
        .attr("y2", (d) => { return (Math.max(d.target.radius, Math.min(this.height - d.target.radius, d.target.y))); });

    node.attr("transform", (d) => {
      return "translate(" + (Math.max(d.radius, Math.min(this.width - d.radius, d.x))) + "," + (Math.max(d.radius, Math.min(this.height - d.radius, d.y))) + ")";
    });
  },

  _click: function(d) {/*
    if (d3.event.defaultPrevented) return; // click suppressed

    if (!nodeList[d.id]) {
      return; // leaf nodes.
    }
    if (nodeList[d.id].children) {
      nodeList[d.id]._children = nodeList[d.id].children;
      nodeList[d.id].children = null;
    } else {
      nodeList[d.id].children = nodeList[d.id]._children;
      nodeList[d.id]._children = null;
    }
    recomputeNodes();
    this.graph();*/
  },

  _getSize: function(d) {
    let bbox = this.getBBox(),
        cbbox = this.parentNode.getBBox(),
        scale = Math.min(cbbox.width/bbox.width, cbbox.height/bbox.height);
    d.scale = scale;
  },

  setTypeAndNamespace: function(type, namespace) {
    this._currentType = type;
    this._currentNamespace = namespace;
  },

  graph: function(data, clearChart) {
    console.log("links? " + JSON.stringify(data.links));
    console.log("nodes? " + JSON.stringify(data.nodes));
    try {
    data.nodes[0].x = this.width / 2 - this.MAIN_RADIUS / 2;
    data.nodes[0].y = this.height / 2 - this.MAIN_RADIUS / 2;

    let nodes = data.nodes;
    let links = data.links;

    console.log("width" + this.width);
    console.log("height" + this.height);
    console.log("NODES" + JSON.stringify(nodes));

    this.force
      .nodes(nodes)
      .links(links)
      .start();

    link = this.svg.select(".links").selectAll(".link")
    link = link.data(links);
    link.exit().remove();
    link.enter().append("line")
      .attr("class", "link");

    node = this.svg.select(".nodes").selectAll(".node");
    node = node.data(nodes, function(d) { return  d.id; });
    node.exit().remove();
    node.enter().append("g")
      .attr("class", "node")
      .on("click", this._click)
      .call(this.force.drag);

    node.append("circle")
      .attr("class", "node")
      .attr("r", function(d) { return d.radius; } )
      .style('fill', (d) => { return this.colors(d.id); })

    node.append("text")
      .text(function(d) { return d.name; })
      .style("font-size", "1px")
      .each(function(d) {
        let bbox = this.getBBox(),
        cbbox = this.parentNode.getBBox(),
        scale = Math.min(cbbox.width/bbox.width, cbbox.height/bbox.height);
        d.scale = scale;
      })
      .style("font-size", function(d) { return d.scale + "px"; });
    } catch (ex) {
      console.log("ERROR\n\n\n\n" + ex);
    }
  }
}
