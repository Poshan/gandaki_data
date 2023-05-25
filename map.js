L.LabelOverlay = L.Layer.extend({
    initialize: function ( /*LatLng*/ latLng, /*String*/ label, options) {
        this._latlng = latLng;
        this._label = label;
        L.Util.setOptions(this, options);
    },
    options: {
        offset: new L.Point(-2, -1)
    },
    onAdd: function (map) {
        this._map = map;
        if (!this._container) {
            this._initLayout();
        }
        map.getPanes().popupPane.appendChild(this._container);
        this._container.innerHTML = this._label;
        map.on('movestart', this._update_start, this);
        map.on('moveend', this._update_end, this);
        this._update_end();
    },
    onRemove: function (map) {
        map.getPanes().popupPane.removeChild(this._container);
        map.off('movestart', this._update_start, this);
        map.off('moveend', this._update_end, this);
    },
    _update_start: function () {
        L.DomUtil.setPosition(this._container, 0);
    },
    _update_end: function () {
        var pos = this._map.latLngToLayerPoint(this._latlng);
        var op = new L.Point(pos.x + this.options.offset.x, pos.y - this.options.offset.y);
        L.DomUtil.setPosition(this._container, op);
    },
    _initLayout: function () {
        this._container = L.DomUtil.create('div', 'leaflet-label-overlay');
    }
});


//zzooom home button
L.Control.zoomHome = L.Control.extend({
    options: {
        position: 'topright',
        zoomInText: '+',
        zoomInTitle: 'Zoom in',
        zoomOutText: '-',
        zoomOutTitle: 'Zoom out',
        zoomHomeText: '<i class="fa fa-arrow-left" style="line-height:1.65;"></i>',
        zoomHomeTitle: 'Show districts'
    },

    onAdd: function (map) {
        var controlName = 'gin-control-zoom',
            container = L.DomUtil.create('div', controlName + ' leaflet-bar'),
            options = this.options;

        this._zoomInButton = this._createButton(options.zoomInText, options.zoomInTitle,
            controlName + '-in', container, this._zoomIn);
        this._zoomHomeButton = this._createButton(options.zoomHomeText, options.zoomHomeTitle,
            controlName + '-home', container, this._zoomHome);
        this._zoomOutButton = this._createButton(options.zoomOutText, options.zoomOutTitle,
            controlName + '-out', container, this._zoomOut);

        this._updateDisabled();
        map.on('zoomend zoomlevelschange', this._updateDisabled, this);

        return container;
    },

    onRemove: function (map) {
        map.off('zoomend zoomlevelschange', this._updateDisabled, this);
    },

    _zoomIn: function (e) {
        this._map.zoomIn(e.shiftKey ? 3 : 1);
    },

    _zoomOut: function (e) {
        this._map.zoomOut(e.shiftKey ? 3 : 1);
    },

    _zoomHome: function (e) {
        map.setView([28.5, 84], 8);
        //reset the style of the local units
        changeLabels(allLocalLevelLabels, true);
        changeLabels(allDistrictLabels, false);
        if (!map.hasLayer(districts)) {
            districts.eachLayer(function (layer) {
                layer.on({
                    click: zoomToFeature
                });
            })
            map.addLayer(districts);
            changeLabels(allDistrictLabels, false);
        }
        if (map.hasLayer(localUnits)) {
            // map.removeLayer(localUnits);
            changeLabels(allLocalLevelLabels, true);
        }

        info.update();


        if (map.hasLayer(localUnits)) {
            // localUnits.setStyle(localStyle);
            map.removeLayer(localUnits);
            // localUnits.clearLayers();
            //reset the style too
        }

    },

    _createButton: function (html, title, className, container, fn) {
        var link = L.DomUtil.create('a', className, container);
        link.innerHTML = html;
        link.href = '#';
        link.title = title;

        L.DomEvent.on(link, 'mousedown dblclick', L.DomEvent.stopPropagation)
            .on(link, 'click', L.DomEvent.stop)
            .on(link, 'click', fn, this)
            .on(link, 'click', this._refocusOnMap, this);

        return link;
    },

    _updateDisabled: function () {
        var map = this._map,
            className = 'leaflet-disabled';

        L.DomUtil.removeClass(this._zoomInButton, className);
        L.DomUtil.removeClass(this._zoomOutButton, className);

        if (map._zoom === map.getMinZoom()) {
            L.DomUtil.addClass(this._zoomOutButton, className);
        }
        if (map._zoom === map.getMaxZoom()) {
            L.DomUtil.addClass(this._zoomInButton, className);
        }
    }
});



//map nepali names to district
var mapNepaliDist = {
    'BAGLUNG': 'बागलुङ',
    'GORKHA': 'गोरखा',
    'KASKI': 'कास्की',
    'LAMJUNG': 'लमजुङ',
    'MANANG': 'मनाङ',
    'MUSTANG': 'मुस्ताङ',
    'MYAGDI': 'म्याग्दी',
    'NAWALPARASI_E': 'नवलपरासी (बर्दघाट सुस्ता पूर्व)',
    'PARBAT': 'पर्वत',
    'SYANGJA': 'स्याङ्जा',
    'TANAHU': 'तनहुँ'
}


//helper function 
function convertToNepaliUnicode(number) {
    // Define the mapping of English digits to Hindi Unicode characters
    const hindiDigits = {
        '0': '\u0966',
        '1': '\u0967',
        '2': '\u0968',
        '3': '\u0969',
        '4': '\u096A',
        '5': '\u096B',
        '6': '\u096C',
        '7': '\u096D',
        '8': '\u096E',
        '9': '\u096F',
    };

    // Convert each digit to its Hindi Unicode equivalent
    const convertedNumber = String(number)
        .split('')
        .map((digit) => hindiDigits[digit] || digit)
        .join('');

    return convertedNumber;
}


//global variables
// for production
// var baseURL = 'https://data.recc.com.np/uploads';

//For test setting the files at local folder
var baseURL = 'uploads';
var districtNameClicked;

// Map variables
var map = L.map('map-div', {
    minZoom: 8,
    maxZoom: 11,
    zoomControl: false
}).setView([28.5, 84], 8);


//helper function to add/remove layers in a map
function changeLabels(labels, remove) {
    if (remove) {
        labels.forEach(element => {
            map.removeLayer(element);
        });
    } else {
        labels.forEach(element => {
            map.addLayer(element);
        });
    }
}

//Panel to show the information of the local level
var info = L.control({position: 'bottomright'});

info.onAdd = function (map) {
    this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
    this.update();
    return this._div;
};

// method that we will use to update the control based on feature properties passed
info.update = function (props) {
    var content = '<span id = "dist"></span><h4>स्थानीय तहको विवरण</h4>';
    if (props) {
        for (const key in props) {
            content += `<b>${key}:</b>${props[key]}<br />`;
        }
    } else {
        content += 'स्थानीय तहमा क्लिक गर्नुहोस';
    }
    this._div.innerHTML = content;
};

info.addTo(map);


var zoomHome = new L.Control.zoomHome();
zoomHome.addTo(map);


//push all labels in a array to remove and add them at once
var allDistrictLabels = [];
var allLocalLevelLabels = [];

//local level GIS layer

//on the click of a local level
function zoomToLocalFeature(e) {
    //clear the info panel
    info.update();
    // var code = e.target.feature.properties.Code;
    var district = e.target.feature.properties.DISTRICT;
    // var gapa = e.target.feature.properties.GaPa_NaPa;
    var code = e.target.feature.properties.Code;
    var gapa_np = e.target.feature.properties.name_np;
    var contentForPanel = {};
    contentForPanel['जिल्ला'] = mapNepaliDist[district];
    contentForPanel['स्थानीय तह'] = gapa_np;
    info.update(contentForPanel);
    
    var url = `${baseURL}/${code}_W.CSV`;
    $.ajax({
        dataType: "text",
        url: url,
        success: function (data) {
            var obj = Papa.parse(data).data;
            obj.shift();
            var male_population = 0;
            var female_population = 0;
            var ward_nos = 0;
            obj.forEach(element => {
                male_population += parseInt(element[1]);
                female_population += parseInt(element[2]);
                ward_nos += 1;
            });
            contentForPanel['वडा संख्या'] = convertToNepaliUnicode(ward_nos);
            contentForPanel['महिला'] = convertToNepaliUnicode(female_population);
            contentForPanel['पुरुष'] = convertToNepaliUnicode(male_population);
            info.update(contentForPanel);
        }
    });

    // if another data is to be loaded...ajax here to load another csv
    //info.update(contentForPanel);
    map.fitBounds(e.target.getBounds());
}

function onEachLocalFeature(feature, layer) {
    layer.on({
        click: zoomToLocalFeature
    });

}

function localStyle(feature) {
    return {
        fillColor: '#fff',
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.9
    };
}

var localUnits = new L.geoJSON(null, {
    style: localStyle,
    onEachFeature: onEachLocalFeature
});

$.ajax({
    dataType: 'json',
    url: 'local_units.geojson',
    success: function (data) {
        $(data.features).each(function (key, data) {
            localUnits.addData(data);
        });
    }
});


// district layer related 
function getColor(d) {
    return d == 412 ? '#800026' :
        d == 411 ? '#BD0026' :
        d == 410 ? '#E31A1C' :
        d == 409 ? '#FC4E2A' :
        d == 408 ? '#FD8D3C' :
        d == 407 ? '#FEB24C' :
        d == 406 ? '#bac8ff' :
        d == 405 ? '#FED976' :
        d == 404 ? '#51cf66' :
        d == 403 ? '#a9e34b' :
        d == 402 ? '#c3fae8' :
        d == 401 ? '#bdb76b' :
        '#FFEDA0';
}

function style(feature) {
    return {
        fillColor: getColor(feature.properties.CODE),
        weight: 2,
        opacity: 1,
        color: 'white',
        dashArray: '3',
        fillOpacity: 0.7
    };
}



//on the click of the district
function zoomToFeature(e) {
    //e.target
    //get distrit code
    var districtNameClicked = e.target.feature.properties.DISTRICT;
    $("#dist").html(`${mapNepaliDist[districtNameClicked]} जिल्ला`);
    
    // var district_code = e.target.feature.properties.CODE;
    //removing district lables
    changeLabels(allDistrictLabels, true);
    //remove all the locallevels and local level labels
    changeLabels(allLocalLevelLabels, true);
    if ((map.hasLayer(localUnits))) {
        changeLabels(allLocalLevelLabels, true);
        map.removeLayer(localUnits);
    }

    localUnits.eachLayer(function (layer) {
        // Styling so that only that districts local units are highlighted
        if (layer.feature.properties.DISTRICT == districtNameClicked) {
            layer.setStyle({
                fillColor: '#fff',
                weight: 2,
                opacity: 1,
                color: '#15aabf',
                dashArray: '3',
                fillOpacity: 0.9
            });
            var center_lat = layer.getBounds().getCenter().lat;
            var center_lng = layer.getBounds().getCenter().lng;
            var labelLocation = new L.LatLng(center_lat, center_lng);
            var labelContent = `${layer.feature.properties.name_np}`;
            var labelTitle = new L.LabelOverlay(labelLocation, labelContent);
            allLocalLevelLabels.push(labelTitle);
            map.addLayer(labelTitle)
        } else {
            layer.clickable = false;
            layer.setStyle({
                fillColor: '#ff7800',
                weight: 2,
                opacity: 0,
                fillOpacity: 0
            })
        }
    });


    localUnits.addTo(map);
    map.fitBounds(e.target.getBounds());

}


function onEachDistrictFeature(feature, layer) {

    layer.on({
        click: zoomToFeature
    });
    var center_lat = layer.getBounds().getCenter().lat;
    var center_lng = -0.04 + layer.getBounds().getCenter().lng;
    var labelLocation = new L.LatLng(center_lat, center_lng);

    var labelContent = `<b class='labels'>${mapNepaliDist[feature.properties.DISTRICT]}</b>`;
    var labelTitle = new L.LabelOverlay(labelLocation, labelContent);
    allDistrictLabels.push(labelTitle);
    map.addLayer(labelTitle);


}


var districts = new L.geoJson(null, {
    style: style,
    onEachFeature: onEachDistrictFeature
});
$.ajax({
    dataType: 'json',
    url: 'Gandaki_WGS.geojson',
    success: function (data) {
        $(data.features).each(function (key, data) {
            districts.addData(data);
        });
        districts.addTo(map);
    }
});


// var baseMaps = {
//     "baselayers": osm
// };

// var overlayMaps = {
//     "Districts": districts,
//     "Local Units": localUnits
// };

// L.control.layers(baseMaps, overlayMaps).addTo(map);


// map.on('movestart', function () {
//     //loop through all the labels
//     //remove them map.removeLayer()
//     changeLabels(allDistrictLabels, true);
//     changeLabels(allLocalLevelLabels, true);
//     $(".leaflet-label-overlay").each(function (i) {
//         // debugger;
//         $(this).css("font-size", Math.pow(2, map.getZoom()) / 2000 + "%").css("margin-left", -$(
//                 this).width() /
//             2).css("margin-top", -$(this).height() / 2);
//     });
// });
// map.on('moveend', function () {
//     changeLabels(allDistrictLabels, false);
//     changeLabels(allLocalLevelLabels, false);
// });
