"""Independent read-back checks; no physics qualification is inferred."""
import bpy
import bmesh
from mathutils import Vector
import argparse
from pathlib import Path
import json
import math
import sys

ap=argparse.ArgumentParser();ap.add_argument('--folder',required=True)
args=ap.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=Path(args.folder)
p=json.loads((folder/'parameters.json').read_text(encoding='utf-8'))
bpy.ops.wm.open_mainfile(filepath=str(folder/'microwave_solwave.blend'))
scene=bpy.context.scene
try:
    prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
    for device in prefs.devices:device.use=device.type!='CPU'
    if any(device.use for device in prefs.devices):scene.cycles.device='GPU'
except Exception:
    scene.cycles.device='CPU'
col=bpy.data.collections['MICROWAVE | photo reconstruction']
objects=list(col.objects)
def bounds(objects):
    points=[];dg=bpy.context.evaluated_depsgraph_get();faces=0
    for obj in objects:
        if obj.type not in ['MESH','FONT','CURVE']:continue
        ev=obj.evaluated_get(dg);m=ev.to_mesh()
        points.extend(ev.matrix_world@v.co for v in m.vertices)
        faces+=len(m.polygons);ev.to_mesh_clear()
    assert points and all(math.isfinite(v) for pt in points for v in pt)
    lo=[min(pt[i] for pt in points) for i in range(3)]
    hi=[max(pt[i] for pt in points) for i in range(3)]
    return {'min_m':lo,'max_m':hi,'dimensions_m':[hi[i]-lo[i] for i in range(3)],'evaluated_faces':faces}
bb=bounds(objects)
door=bpy.data.objects['ASSEMBLY_Door_PIVOT_Z']
door_desc=list(door.children_recursive)
all_meshes=[o for o in objects if o.type=='MESH']
bad_meshes=[o.name for o in all_meshes if not o.data.vertices or not o.data.polygons]
assert not bad_meshes
assert abs(bb['dimensions_m'][0]-p['body_width_m'])<.0001
assert abs(bb['dimensions_m'][2]-(p['body_height_m']+p['body_bottom_m']))<.0001
assert all(o.parent==door for o in objects if o.name.startswith('Handle_'))
assert not any(o.rigid_body or o.rigid_body_constraint for o in objects)
assert not any(o.constraints for o in objects)
assert abs(door.rotation_euler.z)<1e-8
v=p['vents']; dg=bpy.context.evaluated_depsgraph_get()
vent_checks={}
for name in ['Vent_Fascia','Shell_RoundedCabinet']:
    obj=bpy.data.objects[name].evaluated_get(dg);inv=obj.matrix_world.inverted()
    misses=0
    for row in range(v['rows']):
        for col_i in range(v['columns']):
            x=v['center_x']+(col_i-(v['columns']-1)/2)*v['pitch_x']
            z=v['center_z']+(row-.5)*v['pitch_z']
            hit,*_=obj.ray_cast(inv@Vector((x,-.27,z)),(inv.to_3x3()@Vector((0,1,0))).normalized(),distance=.09)
            misses+=not hit
    vent_checks[name]={'centres_tested':18,'unobstructed_through_this_part':misses}
    assert misses==18,(name,misses)
screen=bpy.data.objects['Door_Perforated_SafetyScreen']
report={'scope':'source geometry and export readback only; no solver/physics acceptance',
    'blender':bpy.app.version_string,'source_objects':len(objects),
    'source_meshes':len(all_meshes),'source_texts':sum(o.type=='FONT' for o in objects),
    'source_bounds':bb,'door_child_count':len(door_desc),
    'screen_through_holes':screen['through_hole_count'],'vent_raycast_checks':vent_checks,
    'invalid_empty_meshes':bad_meshes,'rigid_bodies':0,'constraints':0,
    'source_checks':'passed','physics':'not_run'}
def world_hit(name,origin,direction):
    obj=bpy.data.objects[name].evaluated_get(dg);inv=obj.matrix_world.inverted()
    hit,location,normal,index=obj.ray_cast(inv@Vector(origin),(inv.to_3x3()@Vector(direction)).normalized(),distance=1)
    assert hit,(name,origin)
    return obj.matrix_world@location
door_hit=world_hit('Door_Stainless_Frame',(.12,-.4,.325),(0,1,0))
panel_hit=world_hit('Control_StainlessFace',(.234,-.4,.325),(0,1,0))
front_delta=abs(door_hit.y-panel_hit.y)
assert front_delta<1e-6,front_delta
assert abs(door_hit.y-p['door']['front_y'])<1e-6
dp=p['door'];er=dp['edge_radius_m'];t=math.pi/4
edge_x=dp['left']+er*(1-math.sin(t))
edge=world_hit('Door_Stainless_Frame',(edge_x,-.4,.1955),(0,1,0))
expected_y=dp['front_y']+er*(1-math.cos(t))
assert abs(edge.y-expected_y)<.00002,(list(edge),expected_y)
cr=p['case_corner_radius_m'];top=p['body_bottom_m']+p['body_height_m']
corner_z=top-cr+cr*math.cos(t)
corner=world_hit('Shell_RoundedCabinet',(-.4,0,corner_z),(1,0,0))
expected_x=-p['body_width_m']/2+cr-cr*math.sin(t)
assert abs(corner.x-expected_x)<.00002,(list(corner),expected_x)
report['requested_corrections']={
    'door_front_y_m':door_hit.y,'control_front_y_m':panel_hit.y,'front_plane_difference_m':front_delta,
    'flush_check':'passed','cabinet_outer_radius_m':cr,'cabinet_45deg_surface_error_m':abs(corner.x-expected_x),
    'door_edge_roll_radius_m':er,'door_45deg_surface_error_m':abs(edge.y-expected_y),
    'door_outline_radius_m':dp['corner_radius'],'rounded_geometry_check':'passed'}
c=p['control'];label_hit=world_hit('Control_Label_BlueGrey',(.234,-.4,.280),(0,1,0))
pocket_hit=world_hit('Control_StainlessFace',(.234,-.4,.280),(0,1,0))
recess=label_hit.y-panel_hit.y
assert recess>0 and abs(recess-c['panel_recess_m'])<1e-6
assert abs(pocket_hit.y-panel_hit.y-c['pocket_depth_m'])<1e-6
assert pocket_hit.y>label_hit.y+.0004
assert bpy.data.objects.get('Control_Label_SilverRim') is None
shell=bpy.data.objects['Shell_RoundedCabinet'];bm=bmesh.new();bm.from_mesh(shell.data)
assert all(material is not None for material in shell.data.materials)
nonmanifold=sum(not edge.is_manifold for edge in bm.edges)
components=0;seen=set()
for vertex in bm.verts:
    if vertex in seen:continue
    components+=1;pending=[vertex];seen.add(vertex)
    while pending:
        current=pending.pop()
        for edge in current.link_edges:
            adjacent=edge.other_vert(current)
            if adjacent not in seen:seen.add(adjacent);pending.append(adjacent)
bm.free()
assert nonmanifold==0,nonmanifold
assert components==1,components
i=p['interior'];mr=i['mouth_roll_radius_m'];front=i['front_y'];cx=(i['left']+i['right'])/2;cz=(i['bottom']+i['top'])/2
cavity_samples=[]
for offset in [.0002,.001,.0025,.004,.006,.009,.0125,.016,.030]:
    y=front+offset
    expand=mr*(1-math.sqrt(1-(1-offset/mr)**2)) if offset<mr else 0
    for direction,axis,expected in [((0,0,1),2,i['top']+expand),((0,0,-1),2,i['bottom']-expand),((1,0,0),0,i['right']+expand),((-1,0,0),0,i['left']-expand)]:
        hit=world_hit('Shell_RoundedCabinet',(cx,y,cz),direction)
        error=abs(hit[axis]-expected)
        assert error<.00002,(offset,direction,list(hit),expected,error)
        cavity_samples.append({'y_m':y,'direction':direction,'surface_error_m':error})
report['requested_corrections']['dark_control_insert']={'recess_m':recess,'pocket_depth_m':pocket_hit.y-panel_hit.y,'true_pocket_check':'passed'}
report['requested_corrections']['cavity_connection']={'mesh':shell.name,'connected_components':components,'nonmanifold_edges':nonmanifold,'boolean_corner_repair_faces':shell.get('boolean_corner_repair_faces',0),'sampled_cross_sections':9,'radial_surface_checks':len(cavity_samples),'max_surface_error_m':max(row['surface_error_m'] for row in cavity_samples),'no_gap_check':'passed','samples':cavity_samples}
assert bpy.data.images.get('user_reference.png').packed_file
fonts=[(f.name,bool(f.packed_file)) for f in bpy.data.fonts if f.filepath and not f.filepath.startswith('<')]
assert all(packed for _,packed in fonts)
report['packed_dependencies']={'reference':True,'fonts':fonts}
# Close views are actual renders of the saved source, not edited photos.
camera=scene.camera;old_matrix=camera.matrix_world.copy();old_type=camera.data.type;old_lens=camera.data.lens
scene.cycles.samples=64;scene.render.resolution_x=1200;scene.render.resolution_y=900
camera.data.type='ORTHO';camera.data.ortho_scale=.255
camera.location=(-.55,-.7,.57)
camera.rotation_euler=(Vector((-.205,-.174,.307))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/'rounded_corner_detail.png');bpy.ops.render.render(write_still=True)
camera.location=(.46,-.8,.64);camera.data.ortho_scale=.245
camera.rotation_euler=(Vector((.165,-.201,.299))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/'flush_panel_detail.png');bpy.ops.render.render(write_still=True)
camera.location=(.53,-.7,.35);camera.data.ortho_scale=.21
camera.rotation_euler=(Vector((.236,-.24,.247))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/'recessed_control_detail.png');bpy.ops.render.render(write_still=True)
door.rotation_euler.z=math.radians(-p['door_open_degrees']);bpy.context.view_layer.update()
camera.location=(.04,-.92,.40);camera.data.ortho_scale=.46
camera.rotation_euler=(Vector((-.046,-.14,.18))-camera.location).to_track_quat('-Z','Y').to_euler()
scene.render.filepath=str(folder/'continuous_cavity_detail.png');bpy.ops.render.render(write_still=True)
door.rotation_euler.z=0;bpy.context.view_layer.update()
camera.matrix_world=old_matrix;camera.data.type=old_type;camera.data.lens=old_lens
# Keep the source studio and camera, replace only the asset with actual USD import.
for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
before=set(bpy.data.objects)
bpy.ops.wm.usd_import(filepath=str(folder/'microwave_solwave_visual.usdc'))
usd_objects=[o for o in bpy.data.objects if o not in before]
ub=bounds(usd_objects)
err=max(abs(a-b) for field in ['min_m','max_m'] for a,b in zip(bb[field],ub[field]))
assert err<.00002,err
assert not any(o.type in ['CAMERA','LIGHT'] for o in usd_objects)
assert len([o for o in usd_objects if o.type=='MESH'])==report['source_meshes']+report['source_texts']
report['usd_readback']={'objects':len(usd_objects),'meshes':sum(o.type=='MESH' for o in usd_objects),'bounds':ub,'max_bound_error_m':err,'checks':'passed','material_note':'USD Preview Surface approximates Blender procedural brush and optical glass.'}
scene.cycles.samples=48;scene.render.resolution_x=1200;scene.render.resolution_y=864
scene.render.filepath=str(folder/'usd_readback.png')
bpy.ops.render.render(write_still=True)
(folder/'geometry_audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print('AUDIT_COMPLETE',json.dumps(report,ensure_ascii=False))
