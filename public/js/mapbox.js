/* eslint-disable*/

export const displayMap = locations => {
    mapboxgl.accessToken =
        'pk.eyJ1IjoiaHM5MDIxNDAxIiwiYSI6ImNrODYxN3J6dTBjdTEzbXA4N214eXQwODIifQ.KEg_9CbqxIVlWf3XY1d5CA';
    var map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/hs9021401/ck8625vwr0ol01intss4pwqbq',
        scrollZoom: false
        // center: [-118.334172, 34.207568],
        // zoom: 15
    });

    const bounds = new mapboxgl.LngLatBounds();

    locations.forEach(loc => {
        //Create marker
        const el = document.createElement('div');
        el.className = 'marker';

        //Add marker
        new mapboxgl.Marker({
            element: el,
            anchor: 'bottom'
        })
            .setLngLat(loc.coordinates)
            .addTo(map);

        new mapboxgl.Popup({
            offset: 30
        })
            .setLngLat(loc.coordinates)
            .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
            .addTo(map);

        // Extend map bounds to include current location
        bounds.extend(loc.coordinates);
    });

    map.fitBounds(bounds, {
        padding: {
            bottom: 150,
            top: 200,
            left: 100,
            right: 100
        }
    });
};
