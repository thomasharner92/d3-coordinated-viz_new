(function(){
    
    //global variables
    var attrArray = ["Population","Unemployment","Median_Income","Median_Age", "Pct_Native"];
    
    var attrArrayPct = 
    ["Unemployment", "Car_Commute", "Pct_Native"];
    
    var expressed = attrArray[0] // initial attribute (for color scale)
    
    var chartWidth = window.innerWidth * 0.425;
    var chartHeight = 600;
    // original yScale
    var yScale = d3.scaleLinear()
            .range([0, chartHeight])
            .domain([0,1450000]);
    
    
    window.onload = setMap();
    
function setMap(){
    
    var width = window.innerWidth * 0.5;
        height = 600;
    
    var map = d3.select("body")
        .append("svg")
        .attr("class","map")
        .attr("width", width)
        .attr("height", height);
    
    //-41.403893, 173.608462
    
    // Create projection
    var projection = d3.geoAlbers()
        .center([0, -41.296695])
        .rotate([184.27259,0,0])
        .parallels([-90,-40])
        .scale(2500)
        .translate([width / 2, height /2]);
    
    var pathgen = d3.geoPath()
        .projection(projection);
    
    d3.queue()
        .defer(d3.csv, "data/NZ_Statistics.csv") // load attributes
        .defer(d3.json, "data/simgeo.topojson") // load spatial data
        .await(callback);
    

    function callback(error, csv, NZ){
        
        setGraticule(map,pathgen);
        
        var newZealand = topojson.feature(NZ, NZ.objects.simgeo);
        var newZealandRegions = topojson.feature(NZ, NZ.objects.simgeo).features;
        
        
        // Perform join on newZealandRegions to get GeoJSON enumeration units
        newZealandRegions = joinData(csv, newZealandRegions);
        
        // Create the color scale (N breaks)
        var colorScale = makeColorScaleNBreaks(csv);
        
        // Create the color scale (Quantile)
        //var colorScale = makeColorScaleQuantile(csv);
            
        
        // Add enumeration units to map
        setEnumerationUnits(newZealandRegions, map, pathgen, colorScale);
        
        // add coordinated visualization to map
        setChart(csv,colorScale);
        
        // Create and add the drop-down menu
        createDropdown(csv);
        
    
        
    };
    
    
};
    function setGraticule(map,pathgen){
    
    var graticule = d3.geoGraticule()
            .step([5,5]); // place graticule every 5 degrees of Lat/Lon
        
        var gratBackground = map.append("path")
            .datum(graticule.outline())
            .attr("class","gratBackground") // class for styling
            .attr("d",pathgen); // project graticule
        
        var gratLines = map.selectAll(".gratLines")
            .data(graticule.lines())
            .enter()
            .append("path")
            .attr("class","gratLines")
            .attr("d",pathgen);
    };
    
    
    function joinData(csv, newZealandRegions){
        
        for (var i=0; i< csv.length; i++){
            var csvRegion = csv[i]; // current region
            var csvKey = csvRegion.REGC2017_N;
            
            // find the right region to match on key
            for (var x=0; x < newZealandRegions.length; x++){
                var geojsonProps = newZealandRegions[x].properties;
                var geojsonKey = geojsonProps.REGC2017_N;
                
                if(geojsonKey == csvKey){
                    //Assign attributes and values
                    attrArray.forEach(function(attr){
                        var val = parseFloat(csvRegion[attr]); // get attr val
                        geojsonProps[attr] = val;
                    });
                };
            };
            
        };
        
        return newZealandRegions;
        
    };
    
    function setEnumerationUnits(newZealandRegions, map, pathgen, colorScale){
        
        
        var regions = map.selectAll(".regions")
            .data(newZealandRegions)
            .enter()
            .append("path")
            .attr("class",function(d){
                return "regions " + d.properties.REGC2017_N;
                
            })
            .attr("d",pathgen)    
            .style("fill",function(d){
                return choropleth(d.properties, colorScale);
            })
            .on("mouseover",function(d){
                highlight(d.properties);
            })
            .on("mouseout",function(d){
                dehighlight(d.properties);
            });
        
        var desc = regions.append("desc")
            .text('{"stroke": "#000", "stroke-width": "0.5px"}');
    };
    
    function setColorScale(scaleType){
        
        if (scaleType == "Threshold"){
            
            var colorScale = d3.scaleThreshold()
            .range(colorbrewer.Purples[5])
            .domain([0,4]);
            
            
        }
        else if(scaleType == "Quantile"){
            var colorScale = d3.scaleQuantile()
            .range(colorbrewer.Purples[5])
            .domain([0,4]);
        }
        
        return colorScale;
    }

    
    function makeColorScaleNBreaks(data){
        
        var colorScale = setColorScale("Threshold");
        
        // Create array of all values of expressed attribute
        var domainArray = [];
        for (var i = 0; i< data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val) // Creates array of population vals
        };
        
        // Cluster data using ckmeans clustering algorithm (natural breaks)
        var clusters = ss.ckmeans(domainArray,5);
        
        console.log(clusters);
        
        // reset domain array to cluster mins
        domainArray = clusters.map(function(d){
            return d3.min(d);
        });
        
        // remove first val from domain array to create class breakpoints
        domainArray.shift();
        
        // assign array of last 4 cluster mins as domain
        colorScale.domain(domainArray);
        
        return colorScale;
    };
    
    function makeColorScaleQuantile(data){
        /* Test colorbrewer instead
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043"
        ];*/
        
        /*Scales:
        https://bl.ocks.org/mbostock/5577023
        http://stackoverflow.com/questions/40328984/how-to-use-a-colorbrewer-scale
        */
        
        var colorScale = setColorScale("Quantile");
        
        
        // Create array of all values of expressed attribute
        var domainArray = [];
        for (var i = 0; i< data.length; i++){
            var val = parseFloat(data[i][expressed]);
            domainArray.push(val) // Creates array of population vals
        };
        
        // assign array of expressed values as scale domain
        colorScale.domain(domainArray);
        
        return colorScale;
    };
    
    function choropleth(props,colorScale){
        // ensure attribute val is number
        var val = parseFloat(props[expressed]);
        // if attribute value exists, assign color, otherwise gray
        if (typeof val == 'number' && !isNaN(val)){
            return colorScale(val);
        } else{
            return "#CCC";
        };
    };
    
    
    function setChart(csv, colorScale){
        
        
        // Second SVG element to hold the bar chart
        var chart = d3.select("body")
            .append("svg")
            .attr("width",chartWidth)
            .attr("height",chartHeight)
            .attr("class","chart");

        
        // set bars for each region
        var bars = chart.selectAll(".bars")
            .data(csv)
            .enter()
            .append("rect")
            .sort(function(a,b){
                return a[expressed] - b[expressed]
            })
            .attr("class",function(d){
                return "bars " + d.REGC2017_N;
            })
            .attr("width",chartWidth / csv.length -1)
            .attr("x",function(d,i){
                return i * (chartWidth / csv.length);
            })
            .on("mouseover",highlight)
            .on("mouseout",dehighlight);
    
        var desc = bars.append("desc")
            .text('{"stroke": "none", "stroke-width":"0px"}');
    
        var numbers = chart.selectAll(".numbers")
            .data(csv)
            .enter()
            .append("text")
            .sort(function(a,b){;
                return a[expressed] - b[expressed]
            })
            .attr("class", function(d){
                return "numbers " + d.REGC2017_N;
            })
            .attr("text-anchor", "middle")
            .attr("x",function(d,i){
                var fraction = chartWidth / csv.length;
                return i * fraction + (fraction - 1)/2;
            })
            .attr("y",function(d){
                return chartHeight - yScale(parseFloat(d[expressed])) + 8;
            })
            .text(function(d){
                return d[expressed];
            });
        
        // Set title
        var chartTitle = chart.append("text")
            .attr("x",20)
            .attr("y",40)
            .attr("class","chartTitle")
            .text(attrArray[0] + " in each region");
        
        
        updateChart(bars, csv.length, colorScale);
        
    };
    
    
    function createDropdown(csv){
        //add select element
        var dropdown = d3.select("body")
            .append("select")
            .attr("class","dropdown")
            .on("change",function(){
                changeAttribute(this.value, csv)
            });
        
        // add initial option
        var titleOption = dropdown.append("option")
            .attr("class","titleOption")
            .attr("disabled","true")
            .text("Select Attribute");
        
        var attrOptions = dropdown.selectAll("attrOptions")
            .data(attrArray)
            .enter()
            .append("option")
            .attr("value", function(d){return d})
            .text(function(d){return d});
    };
    
    function changeAttribute(attribute, csv){
        // change the expressed attribute
        
        expressed = attribute;
        console.log(csv);
        
        var max = d3.max(csv,function(d){
            return +d[expressed];});
        
        if(attrArrayPct.includes(attribute)){
            
            console.log("in pct");
            
            yScale = d3.scaleLinear()
            .range([0, chartHeight])
            //.domain([30,000,1,500,000])
            .domain([0,1.0]);
            
        }
        else{
            yScale = d3.scaleLinear()
            .range([0, chartHeight])
            //.domain([30,000,1,500,000])
            .domain([0,max]);
        
        }
    
        
        // recreate color scale

        var colorScale = makeColorScaleNBreaks(csv);
        
        var regions = d3.selectAll(".regions")
            .transition()
            .duration(1000)
            .style("fill",function(d){
                return choropleth(d.properties,colorScale)
            });
        
        // re-sort, re-size, and recolor bar chart
        
        
        var bars = d3.selectAll(".bars")
        // re-sort bars
        .sort(function(a,b){
            return a[expressed]-b[expressed];   
        })
        .transition() // add animation 
        .delay(function(d,i){
            return i * 5
        })
        .duration(250);
        
        updateChart(bars, csv.length, colorScale);
        
        
    };
    
    function updateChart(bars, n, colorScale,attribute){
    
        
        // position the bars
        bars.attr("x",function(d,i){
            return i * (chartWidth / n);
        })
        .attr("height",function(d,i){
            return yScale(parseFloat(d[expressed]));
        })
        .attr("y", function(d,i){
            return chartHeight - yScale(parseFloat(d[expressed]));
        })
        // color/re-color bars
        .style("fill",function(d){
            return choropleth(d,colorScale);
        });
        
        
        // Set title
        var chartTitle = d3.select(".chartTitle")
            .text(expressed + " in each region");
        
        var chart = d3.select("body");
        
        
        var numbers = chart.selectAll(".numbers")
        .sort(function(a,b){;
            return a[expressed] - b[expressed]
        })
        .attr("class", function(d){
            return "numbers " + d.REGC2017_N;
        })
        .attr("text-anchor", "middle")
        .attr("x",function(d,i){
            var fraction = chartWidth / n;
            return i * fraction + (fraction - 1)/2;
        })
        .attr("y",function(d){
            return chartHeight - yScale(parseFloat(d[expressed])) + 8;
        })
        .transition() // add animation 
        .delay(function(d,i){
            return i * 5
        })
        .duration(250)
        .text(function(d){
            return d[expressed];
        });
        
        
        
    };
    
    function highlight(props){
        // change the stroke
        console.log(props);
        var selected = d3.selectAll("." + (props.REGC2017_N.replace(/ /g, ".")))
            .style("stroke","red")
            .style("stroke-width","2");
    };
    
    function dehighlight(props){
        var selected = d3.selectAll("." + (props.REGC2017_N.replace(/ /g, ".")))
        .style("stroke",function(){
            return getStyle(this, "stroke");
        })
        .style("stroke-width",function(){
            return getStyle(this,"stroke-width");
        });
 
    };
    
    function getStyle(element, styleName){
        var styleText = d3.select(element)
            .select("desc")
            .text();
        
        var styleObject = JSON.parse(styleText);
        return styleObject[styleName];
    };

    
    
})();
