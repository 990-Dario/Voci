import fs from 'node:fs';
import {geoEqualEarth,geoMercator,geoPath} from 'd3-geo';
const data=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const world=geoEqualEarth().fitExtent([[14,14],[1186,620]],{type:'Sphere'});
const swiss=geoMercator().fitExtent([[30,30],[1170,670]],{type:'FeatureCollection',features:data.items.filter(i=>i.catalogs.includes('ch26')).map(i=>({type:'Feature',geometry:i.geometry}))});
const projected=data.items.map(({geometry,coordinates,...item})=>{
  const projection=item.catalogs.includes('ch26')?swiss:world,path=geoPath(projection).digits(2),feature={type:'Feature',geometry};
  const point=projection(coordinates),bounds=path.bounds(feature),area=path.area(feature);
  return {...item,path:path(feature),point:point.map(x=>+x.toFixed(2)),bounds:bounds.flat().map(x=>+x.toFixed(2)),small:area<35};
});
const result={...data,items:projected,background:geoPath(world).digits(2)({type:'FeatureCollection',features:data.background}),worldViewBox:[0,0,1200,634],swissViewBox:[0,0,1200,700]};
fs.writeFileSync(process.argv[3],JSON.stringify(result));
console.log(`${result.items.length} projected map entries; ${fs.statSync(process.argv[3]).size} bytes`);
