////////////////////////////////////////////////////////////////////////
// Generate key figures from the Humanitarian API (HAPI) as web pages.
//
// Started 2024-10 by David Megginson
////////////////////////////////////////////////////////////////////////


//
// Setup
//


// Change to your own API key
const API_KEY = "SERYLWRhdmlkOm1lZ2dpbnNvbkB1bi5vcmc=";


// HTTP GET parameters
const searchParams = new URLSearchParams(window.location.search);

const HAPI_HOST = "hapi.humdata.org";

const PAGE_SIZE = 10000;

// Exclude from data tables (render functions may add more)
const STOP_LIST = [
    'origin_location_ref',
    'asylum_location_ref',
    'location_ref',
    'location_code',
    'location_name',
    'admin1_ref',
    'admin2_ref',
    'sector_code',
    'org_type_code',
    'resource_hdx_id'
];


// Set up the templating system.
let nunjucks_env = nunjucks.configure({
    autoescape: true,
    web: { async: false }
});
nunjucks_env.addFilter("nfmt", n => (new Intl.NumberFormat().format(n)));

//
// Page-rendering functions
//


/**
 * Look up the list of HRP countries and render as HTML.
 */
async function render_locations () {
    let info = { stop_list: STOP_LIST };
    info.filter = searchParams.get("filter");
    if (!info.filter) {
        info.filter = "hrp";
    }
    let params = {};
    if (info.filter == "hrp") {
        params.has_hrp = true;
    } else if (info.filter == "gho") {
        params.in_gho = true;
    }
    info.locations = await get_data("metadata", "location", params);
    nunjucks.render('templates/locations.template.html', info, redraw_html);
}


/**
 * Look up data for a location (country) page and render it as HTML.
 */
async function render_location () {
    let pcode = searchParams.get("code");
    let info = { stop_list: STOP_LIST };

    info.location = await get_row("metadata", "location", { code: pcode });
    info.admin_level = 0;
    info.geo = info.location;
    info.geo_type = 'location';

    // Grab the admin1 list
    info.admin1s = await get_data("metadata", "admin1", { location_code: pcode });

    // Grab the subcategories
    info.population = await get_subcategory("population-social", "population", { admin_level: 0, location_code: pcode });
    info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 0, location_code: pcode });
    if (info.humanitarian_needs.data.length() == 0) {
        info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 1, location_code: pcode });
    }
    if (info.humanitarian_needs.data.length() == 0) {
        info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 2, location_code: pcode });
    }
    info.operational_presence = await get_subcategory("coordination-context", "operational-presence", { location_code: pcode });
    info.funding = await get_subcategory("coordination-context", "funding", { location_code: pcode });
    info.refugees = await get_subcategory("affected-people", "refugees", { asylum_location_code: pcode });
    info.returnees = await get_subcategory("affected-people", "returnees", { asylum_location_code: pcode });
    info.idps = await get_subcategory("affected-people", "idps", { admin_level: 0, location_code: pcode });
    info.national_risk = await get_subcategory("coordination-context", "national-risk", { location_code: pcode });

    // Extract the sectors from 3W and PIN data
    info.sectors = get_sectors([info.operational_presence, info.humanitarian_needs]);

    // Render the page
    nunjucks.render('templates/location.template.html', info, redraw_html);
}


/**
 * Look up data for an admin1 page and render it as HTML.
 */
async function render_admin1 () {
    let pcode = searchParams.get("code");
    let info = { stop_list: STOP_LIST };

    info.admin1 = await get_row("metadata", "admin1", { code: pcode });
    info.admin_level = 1;
    info.geo = info.admin1;
    info.geo_type = 'admin1';

    info.admin2s = await get_data("metadata", "admin2", { admin1_code: pcode });

    info.population = await get_subcategory("population-social", "population", { admin_level: 1, admin1_code: pcode });
    info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 1, admin1_code: pcode });
    if (info.humanitarian_needs.data.length() == 0) {
        info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 2, admin1_code: pcode });
    }
    info.poverty_rate = await get_subcategory("population-social", "poverty-rate", { location_code: info.admin1.location_code, provider_admin1_name: info.admin1.name });
    info.operational_presence = await get_subcategory("coordination-context", "operational-presence", { admin1_code: pcode });
    if (!info.operational_presence.has_data) {
        info.operational_presence = await get_subcategory("coordination-context", "operational-presence", { provider_admin1_name: info.admin1.name });
        info.op_use_provider_name = true;
    }
    info.idps = await get_subcategory("affected-people", "idps", { admin_level: 1, admin1_code: pcode });
    info.food_price = await get_subcategory("food", "food-price", { admin1_code: pcode });

    info.conflict_event = await get_conflict_event("admin1_code", pcode, 90);

    info.sectors = get_sectors([info.operational_presence, info.humanitarian_needs]);
    console.log(info.sectors);

    nunjucks.render('templates/admin1.template.html', info, redraw_html);
}


/**
 * Look up data for an admin2 page and render it as HTML.
 */
async function render_admin2 () {
    let pcode = searchParams.get("code");
    let info = { stop_list: STOP_LIST };

    info.admin2 = await get_row("metadata", "admin2", { code: pcode });
    info.admin_level = 2;
    info.geo = info.admin2;
    info.geo_type = 'admin2';
    
    info.population = await get_subcategory("population-social", "population", { admin_level: 2, admin2_code: pcode });
    info.humanitarian_needs = await get_subcategory("affected-people", "humanitarian-needs", { admin_level: 2, admin2_code: pcode });
    info.operational_presence = await get_subcategory("coordination-context", "operational-presence", { admin2_code: pcode });
    if (!info.operational_presence.has_data) {
        info.operational_presence = await get_subcategory("coordination-context", "operational-presence", { provider_admin2_name: info.admin2.name });
        info.op_use_provider_name = true;
    }
    info.idps = await get_subcategory("affected-people", "idps", { admin_level: 2, admin2_code: pcode });
    info.food_price = await get_subcategory("food", "food-price", { admin2_code: pcode });

    info.conflict_event = await get_conflict_event("admin2_code", pcode, 90);

    info.sectors = get_sectors([info.operational_presence, info.humanitarian_needs]);

    nunjucks.render('templates/admin2.template.html', info, redraw_html);
}


/**
 * Look up a complete data table and render it as HTML.
 */
async function render_table () {

    let info = { facet: "table", stop_list: [...STOP_LIST] }

    info.category = searchParams.get("category")
    info.subcategory = searchParams.get("subcategory")
    info.location_code = searchParams.get("location-code")
    info.admin1_code = searchParams.get("admin1-code")
    info.provider_admin1_name = searchParams.get("provider-admin1-name")
    info.admin2_code = searchParams.get("admin2-code")
    info.provider_admin2_name = searchParams.get("provider-admin2-name")
    info.sector_code = searchParams.get("sector-code")
    info.admin_level = searchParams.get("admin-level");

    let params = {};

    for (key of [ 'location_code', 'admin1_code', 'admin2_code', 'sector_code', 'admin_level', 'provider_admin1_name', 'provider_admin2_name' ]) {
        // FIXME need either provider_admin*_name or admin*_code, but not both
        if (info[key]) {
            params[key] = info[key];
        }
    }
    if ('provider_admin1_name' in params) {
        delete params['admin1_code'];
    }
    if ('provider_admin2_name' in params) {
        delete params['admin2_code'];
    }

    if (info.sector_code) {
        info.sector = await get_data("metadata", "sector", { code: info.sector_code });
        info.sector = info.sector.first();
    }

    if (info.admin2_code) {
        info.geo = await get_data("metadata", "admin2", { code: info.admin2_code });
        info.admin_level = 2;
    } else if (info.admin1_code) {
        info.geo = await get_data("metadata", "admin1", { code: info.admin1_code });
        info.admin_level = 1;
    } else {
        info.geo = await get_data("metadata", "location", { code: info.location_code });
        info.admin_level = 0;
    }

    if (info.admin_level > 0) {
        info.stop_list.push('provider_admin1_name');
        info.stop_list.push('admin1_name');
        info.stop_list.push('admin1_code');
    }

    if (info.admin_level > 1) {
        info.stop_list.push('provider_admin2_name');
        info.stop_list.push('admin2_name');
        info.stop_list.push('admin2_code');
    }

    console.log(info.stop_list);
    
    info.geo = info.geo.first();

    info.title = "Data: " + capitalize(info.subcategory.replace('-', ' ')) + " for " + make_geo_name(info);

    if (info.sector) {
        info.title += " / " + info.sector.name;
    }

    info.data = await get_data(info.category, info.subcategory, params);

    info.resources = await get_resources(info.data);

    nunjucks.render('templates/table.template.html', info, redraw_html);
}


//
// Data-preparation functions
//


// Merge any sectors from operational presence and humanitarian needs
function get_sectors (datasets) {
    let sector_map = {};
    let result = [];
    for (var data of datasets) {
        if (data) {
            for (var row of data.data.aggregate(['sector_name', 'sector_code'])) {
                if (row.sector_code != 'Intersectoral') {
                    sector_map[row.sector_code] = row.sector_name;
                }
            }
        }
    }
    for (let [key, value] of Object.entries(sector_map)) {
        result.push({ code: key, name: value });
    }
    return new DF.Data(result);
}


//
// Display helper functions
//


/**
 * Redraw the current web page with Nunjucks output.
 */
function redraw_html (error_message, html) {
    if (error_message) {
        alert(error_message);
    } else {
        document.documentElement.innerHTML = html;
    }
}

/**
 * Capitalise the first letter of a string.
 */
function capitalize (s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}


/**
 * Display a message when loading data.
 */
function loading_message (s) {
    document.getElementById("message").textContent = s;
}


/**
 * Construct a human-readable geographic name from data fields
 */
function make_geo_name (data) {

    let elements = [];

    if (data.admin_level == 2) {
        elements.push(data.geo.name);
    } else if (data.provider_admin2_name) {
        elements.push(data.provider_admin2_name);
    }

    if (data.admin_level == 1) {
        elements.push(data.geo.name);
    } else if (data.geo.admin1_name) {
        elements.push(data.geo.admin1_name);
    } else if (data.provider_admin1_name) {
        elements.push(data.provider_admin1_name);
    }

    if (data.geo.location_name) {
        elements.push(data.geo.location_name);
    } else {
        elements.push(data.geo.name);
    }

    return elements.join(", ") + (data.geo ? " (" + data.geo.code + ")" : "");
}


//
// Data-access functions
//


/**
 * Return a list of HDX resource sources for data.
 */
async function get_resources (data) {
    let resources = [];
    for (let resource_id of data.values('resource_hdx_id')) {
        resources.push(await get_row('metadata', 'resource', { resource_hdx_id: resource_id }));
    }
    return new DF.Data(resources);
}


/**
 * Return conflict events for the past number of days specified
 */
async function get_conflict_event (property, value, days) {
    // HAPI can't filter by date, so do that here
    let today = new Date();
    let limit = new Date(new Date().setDate(today.getDate() - days)).toISOString();
    let result = await get_subcategory("coordination-context", "conflict-event", { [property]: value });
    result.data = result.data.filter(r => (r.reference_period_start >= limit));
    return result;
}


/**
 * Return a subcategory object with extra metadata
 */
async function get_subcategory (category, subcategory, params) {
    let result = {};
    result.params = params;

    // API values
    result.data = await get_data(category, subcategory, params);
    result.resources = await get_resources(result.data);

    // calculated values
    result.has_data = result.data.length() > 0;
    if (result.has_data) {
        result.start_date = result.data.min('reference_period_start');
        result.end_date = result.data.max('reference_period_end');
        result.latest_date = result.data.max('reference_period_start');
        result.sources = result.resources.values('dataset_hdx_provider_name');
    }
    
    return result;
}


/**
 * Return the first match for a HAPI query.
 */
async function get_row (category, subcategory, params) {
    let data = await get_data(category, subcategory, params);
    if (data.length() > 0) {
        return data.first();
    } else {
        return null;
    }
}


/**
 * Download data from HAPI.
 */
async function get_data (category, subcategory, params) {
    let result = [];
    let finished = false;
    let offset = 0;

    params = {...params};
    params['app_identifier'] = API_KEY;
    params['limit'] = PAGE_SIZE;

    loading_message("Loading HAPI data: " + category + " / " + subcategory);

    while (!finished) {
        params['offset'] = offset;
        let url = "https://hapi.humdata.org/api/v1/" + category + "/" + subcategory + "?" + new URLSearchParams(params).toString();
        let response = await fetch(url);
        let data = await response.json();
        result.push(...data.data);
        if (data.data.length < PAGE_SIZE) {
            finished = true;
        } else {
            offset += PAGE_SIZE;
        }
    }
    return new DF.Data(result);
}

// end
