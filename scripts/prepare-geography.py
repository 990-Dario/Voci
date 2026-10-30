"""Prepare official source geometry. Run with pyshp 2.3.1, shapely 2.1.2, pyproj 3.7.2."""
import json, sys, io, zipfile, hashlib
from pathlib import Path
import shapefile
from shapely.geometry import shape, mapping
from shapely.geometry.polygon import orient
from shapely.ops import transform, unary_union
from pyproj import Transformer

source=Path(sys.argv[1]);destination=Path(sys.argv[2]);destination.mkdir(parents=True,exist_ok=True)
world=json.loads((source/'world.geojson').read_text(encoding='utf-8'))
un='AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CR CI HR CU CY CZ CD DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB US UY UZ VU VE VN YE ZM ZW VA PS'.split()
ioc=[code for code in un if code!='VA']+'AS AW BM VG KY CK GU HK PR TW VI XK'.split()
assert len(un)==len(set(un))==195
assert len(ioc)==len(set(ioc))==206
regions={'Northern Africa':'Nordafrika','Eastern Africa':'Ostafrika','Middle Africa':'Zentralafrika','Southern Africa':'Südliches Afrika','Western Africa':'Westafrika','Caribbean':'Karibik','Central America':'Zentralamerika','South America':'Südamerika','Northern America':'Nordamerika','Central Asia':'Zentralasien','Eastern Asia':'Ostasien','South-Eastern Asia':'Südostasien','Southern Asia':'Südasien','Western Asia':'Westasien','Eastern Europe':'Osteuropa','Northern Europe':'Nordeuropa','Southern Europe':'Südeuropa','Western Europe':'Westeuropa','Australia and New Zealand':'Australien und Neuseeland','Melanesia':'Melanesien','Micronesia':'Mikronesien','Polynesia':'Polynesien'}
continents={'Africa':'Afrika','Asia':'Asien','Europe':'Europa','North America':'Nordamerika','South America':'Südamerika','Oceania':'Ozeanien'}
slug=lambda s:s.lower().replace(' ','-')
fixes={'FRA':'FR','NOR':'NO','KOS':'XK','TWN':'TW'}
features={fixes.get(f['properties']['ADM0_A3'],f['properties']['ISO_A2']):f for f in world['features'] if f['properties']['ISO_A2']!='-99' or f['properties']['ADM0_A3'] in fixes}
byadm={f['properties']['ADM0_A3']:f for f in world['features']}
# These de facto boundaries remain outlines; the quiz follows the selected UN/IOC membership.
for target,extra in [('SO','SOL'),('CY','CYN')]:
    features[target]['geometry']=mapping(unary_union([shape(features[target]['geometry']),shape(byadm[extra]['geometry'])]))
names={'VA':'Vatikanstadt (Heiliger Stuhl)','PS':'Palästina','TW':'Chinesisch Taipeh (Taiwan)','XK':'Kosovo','CI':'Côte d’Ivoire','CZ':'Tschechien','SZ':'Eswatini','MK':'Nordmazedonien','CD':'Demokratische Republik Kongo','CG':'Republik Kongo','KR':'Südkorea','KP':'Nordkorea','GB':'Vereinigtes Königreich'}
aliases={'VA':['Vatikan','Vatikanstadt','Heiliger Stuhl'],'TW':['Taiwan','Chinesisch Taipeh'],'CI':['Elfenbeinküste',"Côte d'Ivoire"],'GB':['Grossbritannien','Großbritannien','United Kingdom'],'US':['USA','Vereinigte Staaten','United States'],'AE':['Vereinigte Arabische Emirate','VAE'],'CD':['DR Kongo','Kongo-Kinshasa'],'CG':['Kongo-Brazzaville'],'CZ':['Tschechische Republik'],'SZ':['Swasiland'],'MK':['Nordmazedonien'],'PS':['Staat Palästina'],'TL':['Osttimor','Timor-Leste']}
def clockwise(geometry):
    g=shape(geometry)
    if g.geom_type=='Polygon':return mapping(orient(g,sign=-1))
    return {'type':'MultiPolygon','coordinates':[mapping(orient(poly,sign=-1))['coordinates'] for poly in g.geoms if poly.geom_type=='Polygon']}
items=[]
for code in sorted(set(un+ioc)):
    f=features[code];p=f['properties'];region=p['SUBREGION'];continent=p['CONTINENT']
    if code=='XK':region='Southern Europe';continent='Europe'
    if code=='TW':region='Eastern Asia';continent='Asia'
    if code in ['MU','SC']:continent='Africa'
    if code=='MV':continent='Asia'
    assert region in regions,(code,region)
    name=names.get(code,p['NAME_DE'])
    geometry=shape(f['geometry']).simplify(.025,preserve_topology=True)
    items.append({'id':code,'name':name,'aliases':list(dict.fromkeys([name,p['NAME_DE']]+aliases.get(code,[]))),'catalogs':(['un195'] if code in un else [])+(['ioc206'] if code in ioc else []),'continentId':slug(continent),'regionId':slug(region),'coordinates':[p['LABEL_X'],p['LABEL_Y']],'geometry':clockwise(mapping(geometry))})
z=zipfile.ZipFile(source/'swiss.zip');prefix='swissBOUNDARIES3D_1_5_TLM_KANTONSGEBIET'
reader=shapefile.Reader(shp=io.BytesIO(z.read(prefix+'.shp')),dbf=io.BytesIO(z.read(prefix+'.dbf')),encoding='utf-8')
transformer=Transformer.from_crs(2056,4326,always_xy=True)
kantons=['Zürich','Bern','Luzern','Uri','Schwyz','Obwalden','Nidwalden','Glarus','Zug','Freiburg','Solothurn','Basel-Stadt','Basel-Landschaft','Schaffhausen','Appenzell Ausserrhoden','Appenzell Innerrhoden','St. Gallen','Graubünden','Aargau','Thurgau','Tessin','Waadt','Wallis','Neuenburg','Genf','Jura']
codes='ZH BE LU UR SZ OW NW GL ZG FR SO BS BL SH AR AI SG GR AG TG TI VD VS NE GE JU'.split()
kanton_aliases={'FR':['Fribourg'],'GR':['Grisons','Grigioni'],'TI':['Ticino'],'VD':['Vaud'],'VS':['Valais'],'NE':['Neuchâtel'],'GE':['Genève'],'LU':['Lucerne']}
for record in reader.iterShapeRecords():
    number=record.record['KANTONSNUM'];code=codes[number-1];name=kantons[number-1]
    g=transform(transformer.transform,shape(record.shape.__geo_interface__).simplify(100,preserve_topology=True));point=g.representative_point()
    items.append({'id':'CH-'+code,'name':name,'aliases':[name]+kanton_aliases.get(code,[]),'catalogs':['ch26'],'continentId':None,'regionId':None,'coordinates':[point.x,point.y],'geometry':clockwise(mapping(g))})
background=[{'type':'Feature','geometry':clockwise(mapping(shape(f['geometry']).simplify(.04,preserve_topology=True))),'properties':{}} for f in world['features'] if f['properties']['CONTINENT']!='Antarctica']
data={'version':1,'date':'2026-10-29','catalogs':[{'id':'un195','name':'UN-Mitglieder und Beobachterstaaten','count':195},{'id':'ioc206','name':'Olympische Komitees','count':206},{'id':'ch26','name':'Schweizer Kantone','count':26}],'continents':[{'id':slug(k),'name':v} for k,v in continents.items()],'regions':[{'id':slug(k),'name':v} for k,v in regions.items()],'items':items,'background':background,'sourceHashes':{name:hashlib.sha256((source/name).read_bytes()).hexdigest() for name in ['world.geojson','swiss.zip']}}
(destination/'geometry.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(f'{len(items)} unique entries; UN 195, IOC 206, cantons 26')
