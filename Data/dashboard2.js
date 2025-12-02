async function init() {
  const rawData = await d3.csv("car_sales.csv", d => {
    d.Date = new Date(d.Date);
    d.Year = d.Date.getFullYear();
    d['Price ($)'] = +d['Price ($)'];
    return d;
  });

  const companies = Array.from(new Set(rawData.map(d => d.Company))).sort();
  const regions = Array.from(new Set(rawData.map(d => d.Dealer_Region))).sort();
  const allBodyStyles = Array.from(new Set(rawData.map(d => d['Body Style']))).sort();

  document.getElementById("body-filters").innerHTML = allBodyStyles.map(style =>
    `<label><input type="checkbox" class="body-filter" value="${style}" checked> ${style}</label>`
  ).join("");

  document.getElementById("company-filters").innerHTML = companies.map(company =>
    `<label><input type="checkbox" class="company-filter" value="${company}" checked> ${company}</label>`
  ).join("");

  document.getElementById("region-filters").innerHTML = regions.map(region =>
    `<label><input type="checkbox" class="region-filter" value="${region}" checked> ${region}</label>`
  ).join("");

  function getSelectedValues(className) {
    return Array.from(document.querySelectorAll(`.${className}:checked`)).map(el => el.value);
  }

  function updateDashboard() {

    const year = document.getElementById("year-filter").value;
    const gender = document.getElementById("gender-filter").value;
    const selectedBodyStyles = getSelectedValues('body-filter');
    const selectedCompanies = getSelectedValues('company-filter');
    const selectedRegions = getSelectedValues('region-filter');

    const data = rawData.filter(d =>
      (year === 'all' || d.Year.toString() === year) &&
      (gender === 'all' || d.Gender === gender) &&
      selectedBodyStyles.includes(d['Body Style']) &&
      selectedCompanies.includes(d.Company) &&
      selectedRegions.includes(d.Dealer_Region)
    );

    document.getElementById("kpi-sales").innerText = data.length.toLocaleString();
    document.getElementById("kpi-price").innerText = data.length ? "$" + Math.round(d3.mean(data, d => d['Price ($)'])).toLocaleString() : "$0";
    document.getElementById("kpi-total").innerText = "$" + d3.sum(data, d => d['Price ($)']).toLocaleString();
    document.getElementById("kpi-income").innerText = data.length ? "$" + Math.round(d3.mean(data, d => d['Annual Income'])).toLocaleString() : "$0";
    renderSalesTrendChart(data);
    renderSuvSedanTrend(rawData);
    renderRegionBreakdownChart(data);
    renderGenderBodyStyleChart(data);
  }

  document.querySelectorAll("select").forEach(sel =>
    sel.addEventListener('change', updateDashboard)
  );

  document.querySelectorAll("input[type='checkbox']").forEach(cb =>
    cb.addEventListener('change', updateDashboard)
  );

  // Insert 'All' option to filters
  const insertAllOption = (id) => {
    const select = document.getElementById(id);
    const option = document.createElement('option');
    option.value = 'all';
    option.text = 'All';
    select.prepend(option);
    select.value = 'all';
  };

  insertAllOption('year-filter');
  insertAllOption('gender-filter');
  updateDashboard();

  document.getElementById("reset-filters").addEventListener("click", () => {
    document.getElementById("year-filter").value = "all";
    document.getElementById("gender-filter").value = "all";
    document.querySelectorAll(".body-filter").forEach(cb => cb.checked = true);
    document.querySelectorAll(".company-filter").forEach(cb => cb.checked = true);
    document.querySelectorAll(".region-filter").forEach(cb => cb.checked = true);

    updateDashboard();
  });

}

init();

// Render sales trend chart
function renderSalesTrendChart(data) {
  const container = d3.select("#chart-style-trend");
  container.selectAll("*").remove();

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const width = 750 - margin.left - margin.right;
  const height = 425 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const months = d3.rollups(
    data,
    v => v.length,
    d => d3.timeFormat("%Y-%m")(d3.timeMonth(d.Date)),
    d => d['Body Style']
  );

  const bodyStyles = Array.from(new Set(data.map(d => d['Body Style'])));
  const monthKeys = Array.from(new Set(months.map(d => d[0]))).sort();

  const stackedData = monthKeys.map(month => {
    const entry = { month };
    bodyStyles.forEach(style => {
      const foundMonth = months.find(m => m[0] === month);
      const count = foundMonth?.[1].find(([s]) => s === style)?.[1] || 0;
      entry[style] = count;
    });
    return entry;
  });

  const x = d3.scaleBand()
    .domain(monthKeys)
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(stackedData, d => d3.sum(bodyStyles, style => d[style]))])
    .range([height, 0]);


  const blueColors = [
              '#42a5f5',  // Medium Light Blue
              '#64b5f6',  // Light Blue
              '#90caf9',  // Lighter Blue
              '#bbdefb',  // Very Light Blue
              '#e3f2fd'
          ];
const color = d3.scaleOrdinal(blueColors).domain(bodyStyles);

  const stackGen = d3.stack().keys(bodyStyles);
  const series = stackGen(stackedData);
  const tooltip = d3.select("#tooltip");

  svg.append("g")
    .selectAll("g")
    .data(series)
    .join("g")
    .attr("fill", d => color(d.key))
    .selectAll("rect")
    .data(d => d)
    .join("rect")
    .attr("x", d => x(d.data.month))
    .attr("width", x.bandwidth())
    .attr("y", y(0))
    .attr("height", 0)
    .on("mouseover", function (event, d) {
      const style = this.parentNode.__data__.key;
      const value = d[1] - d[0];
      tooltip
        .style("opacity", 1)
        .html(`<strong>${style}</strong><br>Sales: ${value}<br>Month: ${d.data.month}`)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 28) + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    })
    .transition()
    .duration(800)
    .delay((d, i) => i * 20)
    .attr("y", d => y(d[1]))
    .attr("height", d => y(d[0]) - y(d[1]));

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(
      d3.axisBottom(x)
        .tickValues(x.domain().filter((d, i) => i % 3 === 0))
        .tickFormat(d => {
          const date = d3.timeParse("%Y-%m")(d);
          return d3.timeFormat("%b %Y")(date);
        })
    )
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));

  const legend = container.insert("div", ":first-child")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("gap", "15px")
    .style("margin-bottom", "10px")
    .style("flex-wrap", "wrap");


  bodyStyles.forEach(style => {
    legend.append("div").html(`
    <span style="display:inline-block;width:14px;height:14px;margin-right:6px;background:${color(style)};border-radius:3px;"></span>${style}`);
  });
}

// Render SUV vs Sedan trend chart
function renderSuvSedanTrend(data) {
  const container = d3.select("#chart-suv-sedan");
  container.selectAll("*").remove();

  const margin = { top: 30, right: 20, bottom: 50, left: 30 };
  const width = 450 - margin.left - margin.right;
  const height = 425 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const formatMonth = d3.timeFormat("%Y-%m");
  const parseMonth = d3.timeParse("%Y-%m");

  const filtered = data.filter(d => d['Body Style'] === 'SUV' || d['Body Style'] === 'Sedan');

  const grouped = d3.rollup(filtered, v => v.length,
    d => formatMonth(new Date(d.Date)),
    d => d['Body Style']
  );

  const months = Array.from(new Set(filtered.map(d => formatMonth(new Date(d.Date))))).sort();
  const suv = months.map(m => grouped.get(m)?.get('SUV') || 0);
  const sedan = months.map(m => grouped.get(m)?.get('Sedan') || 0);

  const smooth = (arr, w = 3) => arr.map((_, i, a) => d3.mean(a.slice(Math.max(0, i - w + 1), i + 1)));
  const suvSmoothed = smooth(suv);
  const sedanSmoothed = smooth(sedan);

  const x = d3.scaleTime().domain(d3.extent(months, m => parseMonth(m))).range([0, width]);
  const y = d3.scaleLinear().domain([0, d3.max([...suvSmoothed, ...sedanSmoothed])]).range([height, 0]);

  const lineGen = d3.line()
    .x((d, i) => x(parseMonth(months[i])))
    .y(d => y(d))
    .curve(d3.curveMonotoneX);

  // SUV line with animation
  const suvPath = svg.append("path")
    .datum(suvSmoothed)
    .attr("fill", "none")
    .attr("stroke", "#64b5f6")
    .attr("stroke-width", 2.5)
    .attr("d", lineGen);

  const suvLength = suvPath.node().getTotalLength();
  suvPath
    .attr("stroke-dasharray", suvLength + " " + suvLength)
    .attr("stroke-dashoffset", suvLength)
    .transition()
    .duration(2000)
    .ease(d3.easeCubicInOut)
    .attr("stroke-dashoffset", 0);

  // Sedan line with animation
  const sedanPath = svg.append("path")
    .datum(sedanSmoothed)
    .attr("fill", "none")
    .attr("stroke", "#b62727")
    .attr("stroke-width", 2.5)
    .attr("d", lineGen);

  const sedanLength = sedanPath.node().getTotalLength();
  sedanPath
    .attr("stroke-dasharray", sedanLength + " " + sedanLength)
    .attr("stroke-dashoffset", sedanLength)
    .transition()
    .duration(2000)
    .ease(d3.easeCubicInOut)
    .attr("stroke-dashoffset", 0);

  const tooltip = d3.select("#tooltip");

  svg.selectAll(".dot-suv")
    .data(suvSmoothed)
    .join("circle")
    .attr("class", "dot-suv")
    .attr("cx", (d, i) => x(parseMonth(months[i])))
    .attr("cy", d => y(d))
    .attr("r", 4)
    .attr("fill", "#64b5f6")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .on("mouseover", function (event, d) {
      const index = suvSmoothed.indexOf(d);
      tooltip
        .style("opacity", 1)
        .html(`<strong>SUV</strong><br>${months[index]}<br>Sales: ${Math.round(d)}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
      d3.select(this).attr("fill", "#ff6b6b").attr("r", 6);
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
      d3.select(this).attr("fill", "#667eea").attr("r", 4);
    });

  svg.selectAll(".dot-sedan")
    .data(sedanSmoothed)
    .join("circle")
    .attr("class", "dot-sedan")
    .attr("cx", (d, i) => x(parseMonth(months[i])))
    .attr("cy", d => y(d))
    .attr("r", 4)
    .attr("fill", "#b62727")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .on("mouseover", function (event, d) {
      const index = sedanSmoothed.indexOf(d);
      tooltip
        .style("opacity", 1)
        .html(`<strong>Sedan</strong><br>${months[index]}<br>Sales: ${Math.round(d)}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
      d3.select(this).attr("fill", "#ff6b6b").attr("r", 6);
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
      d3.select(this).attr("fill", "#ff7f0e").attr("r", 4);
    });

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x).ticks(d3.timeMonth.every(3)).tickFormat(d3.timeFormat("%b %Y")))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  svg.append("g").call(d3.axisLeft(y));
}


// Render region breakdown chart
function renderRegionBreakdownChart(data) {
  const container = d3.select("#chart-region");
  container.selectAll("*").remove();

  const margin = { top: 30, right: 30, bottom: 50, left: 40 };
  const width = 800 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const formatQuarter = d => `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;


  const grouped = d3.rollups(
    data,
    v => v.length,
    d => formatQuarter(new Date(d.Date)),
    d => d.Dealer_Region
  );

  const quarters = Array.from(new Set(grouped.map(d => d[0]))).sort();
  const regions = Array.from(new Set(data.map(d => d.Dealer_Region))).sort();

  const formatted = quarters.map(q => {
    const regionCounts = grouped.find(([quarter]) => quarter === q)?.[1] || [];
    const entry = { quarter: q };
    regions.forEach(r => {
      entry[r] = regionCounts.find(([region]) => region === r)?.[1] || 0;
    });
    return entry;
  });

  const x0 = d3.scaleBand().domain(quarters).range([0, width]).padding(0.2);
  const x1 = d3.scaleBand().domain(regions).range([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear().domain([0, d3.max(formatted, d => d3.max(regions, r => d[r]))]).range([height, 0]);
  const color = d3.scaleOrdinal().domain(regions).range(d3.schemeSet2);
  const tooltip = d3.select("#tooltip");

  const bars = svg.append("g")
    .selectAll("g")
    .data(formatted)
    .join("g")
    .attr("transform", d => `translate(${x0(d.quarter)},0)`)
    .selectAll("rect")
    .data(d => regions.map(r => ({ region: r, value: d[r], quarter: d.quarter })))
    .join("rect")
    .attr("x", d => x1(d.region))
    .attr("width", x1.bandwidth())
    .attr("y", y(0))
    .attr("height", 0)
    .attr("fill", d => color(d.region))
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.region}</strong><br>Quarter: ${d.quarter}<br>Sales: ${d.value}`)

        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    });

  bars.transition()
    .duration(800)
    .delay((d, i) => i * 10)
    .attr("y", d => y(d.value))
    .attr("height", d => height - y(d.value));

  svg.append("g")
  .attr("transform", `translate(0,${height})`)
  .call(d3.axisBottom(x0));
  svg.append("g").call(d3.axisLeft(y));

  // Legend
  const legend = container.insert("div", ":first-child")
    .style("display", "flex")
    .style("justify-content", "center")
    .style("gap", "15px")
    .style("margin-bottom", "10px")
    .style("flex-wrap", "wrap");

  regions.forEach(region => {
    legend.append("div").html(`
      <span style="display:inline-block;width:14px;height:14px;margin-right:6px;background:${color(region)};border-radius:3px;"></span>${region}
    `);
  });
}

function renderGenderBodyStyleChart(data) {
  const container = d3.select("#chart-gender-style");
  container.selectAll("*").remove();

  const margin = { top: 30, right: 30, bottom: 50, left: 60 };
  const width = 400 - margin.left - margin.right;
  const height = 400 - margin.top - margin.bottom;

  const svg = container.append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const genders = ['Male', 'Female'];
  const bodyStyles = Array.from(new Set(data.map(d => d['Body Style']))).sort();

  const grouped = d3.rollup(
    data,
    v => d3.mean(v, d => d['Price ($)']),
    d => d['Body Style'],
    d => d.Gender
  );

  const formatted = bodyStyles.map(body => {
    const genderMap = grouped.get(body) || new Map();
    return {
      body,
      Male: genderMap.get('Male') || 0,
      Female: genderMap.get('Female') || 0
    };
  });

  const x0 = d3.scaleBand().domain(bodyStyles).range([0, width]).padding(0.2);
  const x1 = d3.scaleBand().domain(genders).range([0, x0.bandwidth()]).padding(0.05);
  const y = d3.scaleLinear().domain([0, d3.max(formatted, d => Math.max(d.Male, d.Female))]).range([height, 0]);
  const color = d3.scaleOrdinal().domain(genders).range(["#64b5f6", "#b62727"]);
  const tooltip = d3.select("#tooltip");

  const bars = svg.append("g")
    .selectAll("g")
    .data(formatted)
    .join("g")
    .attr("transform", d => `translate(${x0(d.body)},0)`)
    .selectAll("rect")
    .data(d => genders.map(g => ({ gender: g, value: d[g], body: d.body })))
    .join("rect")
    .attr("x", d => x1(d.gender))
    .attr("width", x1.bandwidth())
    .attr("y", y(0))
    .attr("height", 0)
    .attr("fill", d => color(d.gender))
    .on("mouseover", function (event, d) {
      tooltip
        .style("opacity", 1)
        .html(`<strong>${d.gender}</strong><br>Body: ${d.body}<br>Avg Price: $${Math.round(d.value).toLocaleString()}`)
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mousemove", function (event) {
      tooltip
        .style("left", event.pageX + 10 + "px")
        .style("top", event.pageY - 28 + "px");
    })
    .on("mouseout", function () {
      tooltip.style("opacity", 0);
    });

  bars.transition()
    .duration(800)
    .delay((d, i) => i * 10)
    .attr("y", d => y(d.value))
    .attr("height", d => height - y(d.value));

  svg.append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x0));

  svg.append("g").call(d3.axisLeft(y));

  // Legend
  const legend = container.insert("div", ":first-child")
    .style("display", "flex")
    .style("justify-content", "flex-end")
    .style("gap", "15px")
    .style("margin-bottom", "10px")
    .style("font-size", "13px");

  genders.forEach(gender => {
    legend.append("div").html(`
      <span style="display:inline-block;width:14px;height:14px;margin-right:6px;background:${color(gender)};border-radius:2px;"></span>${gender}
    `);
  });
}

document.getElementById("toggleSidebar").addEventListener("click", () => {
  document.querySelector(".filter-overlay").classList.toggle("hidden");
});

