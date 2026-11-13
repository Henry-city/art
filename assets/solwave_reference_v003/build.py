"""Native Blender reconstruction of the user photo. SI, Z-up, front -Y.

Uses the project's separate geometry/material and semantic assembly conventions.
No existing product mesh or photo projected on a surface is used. Hidden features
are engineering completion. Open pose is an editing preview, not simulation.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import sys
import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--resolution', type=int, default=1400)
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
OUT = Path(args.output).resolve()
OUT.mkdir(parents=True, exist_ok=False)
P = json.loads((HERE/'parameters.json').read_text(encoding='utf-8'))
A = json.loads((HERE/'materials.json').read_text(encoding='utf-8'))
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.unit_settings.length_unit = 'METERS'
scene['asset_id'] = P['asset_id']
scene['dimension_basis'] = P['dimension_basis']
scene['physics_status'] = P['physics_status']
asset_col = bpy.data.collections.new('MICROWAVE | photo reconstruction')
scene.collection.children.link(asset_col)
studio_col = bpy.data.collections.new('STUDIO | excluded from asset export')
scene.collection.children.link(studio_col)

def relocate(obj, col):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    col.objects.link(obj)

def empty(name, parent=None, location=(0,0,0)):
    obj = bpy.data.objects.new(name, None)
    asset_col.objects.link(obj)
    obj.parent = parent
    obj.location = location
    obj.empty_display_size = .015
    return obj

root = empty('MW_SOLWAVE_REFERENCE')
body = empty('ASSEMBLY_Cabinet', root)
door = empty('ASSEMBLY_Door_PIVOT_Z', root, (P['door']['left']+.004, -.226, 0))
door['preview_open_degrees'] = P['door_open_degrees']
door['note'] = 'Rotate local Z negative to open. Editing hierarchy only; no solver joint.'
knob = empty('ASSEMBLY_TimerKnob', body, ((P['control']['left']+P['control']['right'])/2, P['control']['front_y']+P['control']['panel_recess_m'], P['control']['knob_z']))
parts = []

def material(name, spec):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*spec['color'], 1)
    p.inputs['Metallic'].default_value = spec['metallic']
    p.inputs['Roughness'].default_value = spec['roughness']
    m.diffuse_color = (*spec['color'],1)
    if name=='panel':p.inputs['Specular IOR Level'].default_value=.20
    if 'steel' in name or name == 'interior':
        p.inputs['Anisotropic'].default_value = .0
        nt = m.node_tree
        tex = nt.nodes.new('ShaderNodeTexCoord')
        mapping = nt.nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = (2,1300,1300)
        noise = nt.nodes.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=5
        noise.inputs['Detail'].default_value=2
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.12
        bump.inputs['Distance'].default_value=.000018
        nt.links.new(tex.outputs['Generated'], mapping.inputs[0])
        nt.links.new(mapping.outputs[0], noise.inputs['Vector'])
        nt.links.new(noise.outputs['Fac'], bump.inputs['Height'])
        nt.links.new(bump.outputs['Normal'], p.inputs['Normal'])
    return m

M = {k: material(k,v) for k,v in A.items() if isinstance(v,dict)}
M['ink'] = material('Printed black ink', {'color':(.004,.005,.006),'metallic':0,'roughness':.70})
M['ink'].node_tree.nodes.get('Principled BSDF').inputs['Specular IOR Level'].default_value=.16
M['glass'] = material('Glass | smoke optical layer', {'color':(.90,.93,.94),'metallic':0,'roughness':.075})
gp = M['glass'].node_tree.nodes.get('Principled BSDF')
gp.inputs['Transmission Weight'].default_value = 1
gp.inputs['IOR'].default_value = 1.45

def finish(obj, name, mat, parent=body, basis='photo_visible', group=None):
    obj.name=name
    relocate(obj,asset_col)
    if mat: obj.data.materials.append(M[mat])
    world=obj.matrix_world.copy()
    obj.parent=parent
    # Matrices need a depsgraph update before assigning inverse hierarchy.
    bpy.context.view_layer.update()
    obj.matrix_world=world
    obj['semantic_id']=group or name
    obj['assembly_id']=parent.name if parent else 'root'
    obj['evidence_class']=basis
    obj['source_id']='user_reference' if basis=='photo_visible' else 'engineering_completion'
    parts.append(obj)
    return obj

def bevel(obj, width, segments=6):
    if not width:return
    mod=obj.modifiers.new('Manufactured edge radius','BEVEL'); mod.width=width; mod.segments=segments;mod.harden_normals=True
    mod=obj.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL'); mod.keep_sharp=True; mod.weight=30

def box(name, center, dims, mat, parent=body, radius=.001, basis='photo_visible', group=None):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj=bpy.context.object; obj.dimensions=dims
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if radius:
        for polygon in obj.data.polygons:polygon.use_smooth=True
    finish(obj,name,mat,parent,basis,group); bevel(obj,radius)
    return obj

def mesh(name, vertices, faces, mat, parent=body, basis='photo_visible', group=None):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices,[],faces);data.update()
    bm=bmesh.new(); bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free()
    obj=bpy.data.objects.new(name,data);asset_col.objects.link(obj)
    return finish(obj,name,mat,parent,basis,group)

def rr(cx,cz,w,h,r,n=12):
    pts=[]
    for ox,oz,start in [(w/2-r,h/2-r,0),(-w/2+r,h/2-r,90),(-w/2+r,-h/2+r,180),(w/2-r,-h/2+r,270)]:
        for i in range(n):
            a=math.radians(start+i*90/(n-1))
            pts.append((cx+ox+r*math.cos(a),cz+oz+r*math.sin(a)))
    return pts

def plate(name,cx,cz,w,h,r,y,depth,mat,parent=body,basis='photo_visible'):
    loop=rr(cx,cz,w,h,r); n=len(loop)
    verts=[(x,yy,z) for yy in [y,y+depth] for x,z in loop]
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat,parent,basis)

def ring(name,outer,inner,y,depth,mat,parent=body,basis='photo_visible'):
    loops=[rr(*outer),rr(*inner)]; n=len(loops[0])
    verts=[(x,yy,z) for yy in [y,y+depth] for loop in loops for x,z in loop]
    faces=[]
    for i in range(n):
        j=(i+1)%n
        faces += [(i,j,n+j,n+i),(2*n+i,3*n+i,3*n+j,2*n+j),
                  (i,2*n+i,2*n+j,j),(n+i,n+j,3*n+j,3*n+i)]
    obj=mesh(name,verts,faces,mat,parent,basis);bevel(obj,.00045,2)
    return obj

def rounded_panel(name,outer,inner,y,depth,edge_radius,mat,parent=body):
    """Explicit rolled perimeter. Its radius is independent of sheet thickness.

    Flat front and back stay planar. Quarter-circle sections connect them to
    the outer wall; the window opening retains its exact independent profile.
    """
    cx,cz,w,h,r=outer
    er=edge_radius;br=min(edge_radius,.0015)
    assert r>max(er,br) and depth>er+br
    profiles=[]
    for i in range(17):
        a=i*math.pi/32
        profiles.append((y+er*(1-math.cos(a)),er*(1-math.sin(a))))
    profiles.append((y+depth-br,0))
    for i in range(1,17):
        a=i*math.pi/32
        profiles.append((y+depth-br+br*math.sin(a),br*(1-math.cos(a))))
    verts=[]
    for yy,inset in profiles:
        verts += [(x,yy,z) for x,z in rr(cx,cz,w-2*inset,h-2*inset,r-inset)]
    n=len(rr(*outer));faces=[]
    for layer in range(len(profiles)-1):
        for i in range(n):
            j=(i+1)%n
            faces.append((layer*n+i,layer*n+j,(layer+1)*n+j,(layer+1)*n+i))
    smooth_count=len(faces);last=(len(profiles)-1)*n
    if inner is None:
        faces += [tuple(range(n-1,-1,-1)),tuple(last+i for i in range(n))]
    else:
        start=len(verts)
        verts += [(x,yy,z) for yy in [y,y+depth] for x,z in rr(*inner)]
        for i in range(n):
            j=(i+1)%n
            faces += [(i,j,start+j,start+i),(last+i,start+n+i,start+n+j,last+j),
                      (start+i,start+j,start+n+j,start+n+i)]
    obj=mesh(name,verts,faces,mat,parent)
    for poly in obj.data.polygons:poly.use_smooth=poly.index<smooth_count
    obj['front_plane_y_m']=y
    obj['outer_corner_radius_m']=r
    obj['edge_roll_radius_m']=er
    return obj

def apply_modifiers(obj):
    bpy.context.view_layer.objects.active=obj
    for modifier in list(obj.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)

def build_rounded_shell():
    """Rounded hollow solid instead of separate thin, bevel-clamped boxes."""
    w=P['body_width_m'];d=P['body_depth_m'];h=P['body_height_m'];b=P['body_bottom_m']
    t=P['shell_thickness_m'];r=P['case_corner_radius_m']
    obj=box('Shell_RoundedCabinet',(0,0,b+h/2),(w,d,h),'steel',radius=r)
    obj.modifiers['Manufactured edge radius'].segments=12
    apply_modifiers(obj)
    back=d/2-t;front=-d/2-.035
    cutter=box('_shell_inner',(0,(back+front)/2,b+h/2),(w-2*t,back-front,h-2*t),None,radius=r-t,basis='engineering_completion')
    cutter.modifiers['Manufactured edge radius'].segments=12
    apply_modifiers(cutter)
    cut(obj,cutter)
    obj['outer_corner_radius_m']=r;obj['wall_thickness_m']=t
    obj['construction']='Rounded external solid minus rounded open-front inner cavity; true hollow sheet shell'
    return obj

def cyl(name,center,radius,depth,mat,parent=body,axis='Z',basis='photo_visible',vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=center)
    obj=bpy.context.object
    if axis=='Y':obj.rotation_euler[0]=math.pi/2
    if axis=='X':obj.rotation_euler[1]=math.pi/2
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    finish(obj,name,mat,parent,basis)
    for poly in obj.data.polygons:poly.use_smooth=len(poly.vertices)==4
    bevel(obj,min(.0005,depth*.15),3)
    return obj

FONT=bpy.data.fonts.load('C:/Windows/Fonts/arial.ttf')
BOLD=bpy.data.fonts.load('C:/Windows/Fonts/arialbd.ttf')
def text_obj(name,text,x,y,z,size,mat='print',parent=body,align='CENTER',bold=False,basis='photo_visible'):
    data=bpy.data.curves.new(name,'FONT');data.body=text;data.size=size
    data.font=BOLD if bold else FONT;data.align_x=align;data.align_y='CENTER'
    data.resolution_u=6
    obj=bpy.data.objects.new(name,data);asset_col.objects.link(obj)
    obj.location=(x,y,z);obj.rotation_euler=(math.pi/2,0,0)
    bpy.context.view_layer.update()
    finish(obj,name,mat,parent,basis)
    return obj

def screw(name,x,y,z,parent=body,axis='Y',basis='engineering_completion'):
    obj=cyl(name,(x,y,z),.0026,.0010,'steel',parent,axis,basis,32)
    if axis=='Y':
        box(name+'_cross1',(x,y-.0007,z),(.0032,.0003,.00055),'black',parent,.0001,basis)
        box(name+'_cross2',(x,y-.0007,z),(.00055,.0003,.0032),'black',parent,.0001,basis)
    return obj

def cut(target,cutter):
    # Blender may import the cutter's empty slot even with INDEX mode.
    # Give subtractive tools the target's first real surface material.
    for index,material in enumerate(target.data.materials):
        if material is None:target.data.materials[index]=M['steel']
    cutter.data.materials.clear()
    for material in target.data.materials:cutter.data.materials.append(material)
    for polygon in cutter.data.polygons:polygon.material_index=0
    bpy.context.view_layer.objects.active=target
    m=target.modifiers.new('True through opening','BOOLEAN');m.operation='DIFFERENCE';m.solver='EXACT';m.object=cutter;m.material_mode='INDEX'
    bpy.ops.object.modifier_apply(modifier=m.name)
    parts.remove(cutter);bpy.data.objects.remove(cutter,do_unlink=True)

def combine(target,other,operation):
    for index,material in enumerate(target.data.materials):
        if material is None:target.data.materials[index]=M['steel']
    if operation=='UNION':
        original=[m or target.data.materials[0] for m in other.data.materials]
        names=[m.name for m in target.data.materials]
        mapping=[]
        for material in original:
            if material.name not in names:
                target.data.materials.append(material);names.append(material.name)
            mapping.append(names.index(material.name))
        indices=[mapping[p.material_index] for p in other.data.polygons]
        other.data.materials.clear()
        for material in target.data.materials:other.data.materials.append(material)
        for polygon,index in zip(other.data.polygons,indices):polygon.material_index=index
    else:
        other.data.materials.clear()
        for material in target.data.materials:other.data.materials.append(material)
        for polygon in other.data.polygons:polygon.material_index=0
    bpy.context.view_layer.objects.active=target
    mod=target.modifiers.new('Continuous enclosure '+operation,'BOOLEAN')
    mod.operation=operation;mod.solver='EXACT';mod.object=other
    mod.material_mode='INDEX'
    bpy.ops.object.modifier_apply(modifier=mod.name)
    parts.remove(other);bpy.data.objects.remove(other,do_unlink=True)

def build_integrated_liner(shell):
    """One watertight folded liner/flange, trimmed and unioned to the case skin.

    The rolled mouth and liner share vertex loops. No floating side panels,
    front gap, raised bottom slab, or independent overlapping mouth trim.
    """
    i=P['interior'];cx=(i['left']+i['right'])/2;cz=(i['bottom']+i['top'])/2
    w=i['right']-i['left'];h=i['top']-i['bottom'];r=i['corner_radius_m']
    f=i['front_y'];mr=i['mouth_roll_radius_m'];br=i['rear_roll_radius_m'];back=i['back_y'];t=i['liner_thickness_m']
    verts=[];faces=[];roles=[];smooth=[]
    def loop(yy,ww,hh,rradius,xx=cx,zz=cz):
        index=len(verts);verts.extend((x,yy,z) for x,z in rr(xx,zz,ww,hh,rradius));return index
    n=len(rr(cx,cz,w,h,r))
    def bridge(a,b,role=0,shade=False):
        for k in range(n):
            j=(k+1)%n;faces.append((a+k,a+j,b+j,b+k));roles.append(role);smooth.append(shade)
    def cap(start,role):
        faces.append(tuple(start+k for k in range(n)));roles.append(role);smooth.append(False)
    outer_front=loop(f,P['body_width_m']+.012,P['body_height_m']+.012,.008,0,P['body_bottom_m']+P['body_height_m']/2)
    inner=[]
    for k in range(17):
        a=k*math.pi/32;expand=mr*(1-math.sin(a))
        inner.append(loop(f+mr*(1-math.cos(a)),w+2*expand,h+2*expand,r+expand))
    inner.append(loop(back-br,w,h,r))
    for k in range(1,17):
        a=k*math.pi/32;inset=br*(1-math.cos(a))
        inner.append(loop(back-br+br*math.sin(a),w-2*inset,h-2*inset,r-inset))
    bridge(outer_front,inner[0],0,False)
    for a,b in zip(inner,inner[1:]):bridge(a,b,1,True)
    cap(inner[-1],1)
    flange_back=f+.006
    outer_back=loop(flange_back,P['body_width_m']+.012,P['body_height_m']+.012,.008,0,P['body_bottom_m']+P['body_height_m']/2)
    liner_outer=[loop(flange_back,w+2*t,h+2*t,r+t),loop(back-br,w+2*t,h+2*t,r+t)]
    for k in range(1,17):
        a=k*math.pi/32;inset=(br+t)*(1-math.cos(a))
        liner_outer.append(loop(back-br+(br+t)*math.sin(a),w+2*t-2*inset,h+2*t-2*inset,r+t-inset))
    bridge(outer_front,outer_back,0,False);bridge(outer_back,liner_outer[0],0,False)
    for a,b in zip(liner_outer,liner_outer[1:]):bridge(a,b,1,True)
    cap(liner_outer[-1],1)
    liner=mesh('Cavity_ContinuousLiner_FrontFlange',verts,faces,'door_steel',basis='engineering_completion')
    liner.data.materials.append(M['interior']);liner.data.materials.append(M['ceramic'])
    for poly,role,shade in zip(liner.data.polygons,roles,smooth):
        poly.material_index=role;poly.use_smooth=shade
        zs=[liner.data.vertices[v].co.z for v in poly.vertices]
        if role==1 and max(abs(z-i['bottom']) for z in zs)<1e-6:
            poly.material_index=2;poly.use_smooth=False
    trim=box('_outer_envelope_trim',(0,0,P['body_bottom_m']+P['body_height_m']/2),(P['body_width_m'],P['body_depth_m'],P['body_height_m']),None,radius=P['case_corner_radius_m'])
    trim.modifiers['Manufactured edge radius'].segments=12;apply_modifiers(trim)
    combine(liner,trim,'INTERSECT')
    combine(shell,liner,'UNION')
    shell['construction']='Continuous outer skin, front flange, rolled opening and cavity liner; boolean-unioned thin shells'
    shell['mouth_roll_radius_m']=mr;shell['liner_thickness_m']=t
    shell['cavity_front_y_m']=f;shell['cavity_transition']='shared-vertex rolled mouth; continuous union with exterior'

def recess_control_face(face):
    c=P['control'];cx=(c['left']+c['right'])/2;cz=c['panel_center_z'];f=c['front_y']
    profiles=[(f-.008,c['panel_width']+.0032,c['panel_height']+.0032,.0076),
              (f,c['panel_width']+.0032,c['panel_height']+.0032,.0076),
              (f+c['pocket_depth_m'],c['panel_width']+.0005,c['panel_height']+.0005,.00625)]
    verts=[(x,yy,z) for yy,w,h,r in profiles for x,z in rr(cx,cz,w,h,r)]
    n=len(rr(cx,cz,1,1,.1));faces=[tuple(range(n-1,-1,-1)),tuple(2*n+k for k in range(n))]
    for row in range(2):
        for k in range(n):j=(k+1)%n;faces.append((row*n+k,row*n+j,(row+1)*n+j,(row+1)*n+k))
    cutter=mesh('_control_recess_cutter',verts,faces,None)
    cut(face,cutter)
    face['panel_recess_m']=c['panel_recess_m'];face['pocket_depth_m']=c['pocket_depth_m']

def seal_boolean_corner_sliver(obj):
    """Close only a sub-4 mm perimeter triangular boolean sliver at the base.

    Apertures and the cavity are solid skin tunnels and have no boundary edges.
    Any other topology defect remains an error instead of being blindly capped.
    """
    bm=bmesh.new();bm.from_mesh(obj.data)
    boundary=[edge for edge in bm.edges if edge.is_boundary]
    if boundary:
        verts=set(v for edge in boundary for v in edge.verts)
        assert len(boundary)==3 and len(verts)==3
        assert sum(edge.calc_length() for edge in boundary)<.004
        assert max((obj.matrix_world@v.co).z for v in verts)<.035
        filled=bmesh.ops.holes_fill(bm,edges=boundary,sides=3)['faces']
        for face in filled:face.material_index=0;face.smooth=True
        bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
        obj['boolean_corner_repair_faces']=len(filled)
    assert all(edge.is_manifold for edge in bm.edges)
    bm.to_mesh(obj.data);bm.free();obj.data.update()

def build_cabinet():
    w=P['body_width_m'];d=P['body_depth_m'];h=P['body_height_m'];b=P['body_bottom_m'];t=P['shell_thickness_m']
    shell=build_rounded_shell()
    build_integrated_liner(shell)
    front=box('Vent_Fascia',(0,-.230,.031),(w-.006,.009,.033),'door_steel',radius=0)
    v=P['vents']
    for row in range(v['rows']):
        for col in range(v['columns']):
            x=v['center_x']+(col-(v['columns']-1)/2)*v['pitch_x']
            z=v['center_z']+(row-.5)*v['pitch_z']
            hole=plate('_vent_cutter',x,z,v['width'],v['height'],v['height']/2,-.245,.035,None)
            cut(front,hole)
            hole=plate('_vent_cutter',x,z,v['width'],v['height'],v['height']/2,-.245,.035,None)
            cut(shell,hole)
            box(f'Vent_Baffle_{row}_{col}',(x,-.217,z+.001),(v['width'],.004,.0008),'black',radius=.0002)
    bevel(front,.00035,3)
    box('Vent_Plenum_Back',(v['center_x'],-.194,.031),(.35,.002,.026),'black',radius=0,basis='engineering_completion')
    # Dark plinth behind the low fascia.
    box('Recessed_Base_Shadow',(0,-.221,.014),(w-.018,.012,.008),'black',radius=.001)
    for x in [-.224,.224]:
        for y in [-.173,.173]:
            cyl(f'Foot_{x}_{y}',(x,y,.008),.015,.016,'black',basis='engineering_completion')
    # Right controls: thin separate stainless face and rounded blue-grey insert.
    c=P['control'];cx=(c['left']+c['right'])/2;f=c['front_y'];dp=P['door']
    face=rounded_panel('Control_StainlessFace',(cx,(dp['top']+dp['bottom'])/2,c['right']-c['left'],dp['top']-dp['bottom'],c['corner_radius']),None,f,c['thickness'],c['edge_radius_m'],'door_steel')
    recess_control_face(face)
    label_y=f+c['panel_recess_m']
    plate('Control_Label_BlueGrey',cx,c['panel_center_z'],c['panel_width'],c['panel_height'],.006,label_y,.0004,'panel')
    text_obj('Brand_SOLWAVE','SOLWAVE',cx,f-.00012,.329,.0107,'ink',bold=True)
    text_obj('Brand_Underline','COMMERCIAL MICROWAVE',cx,f-.00012,.321,.0022,'ink')
    # Fine typography is a legible layout approximation, not an OEM instructions reproduction.
    text_obj('Guide_Title','Time Guide',cx-.026,label_y-.00015,.295,.0044,align='LEFT',bold=True,basis='engineering_completion')
    for n,(label,value) in enumerate([('Beverage','0:30 - 1:00'),('Soup','1:00 - 2:00'),('Bread','0:15 - 0:30'),('Vegetables','1:30 - 2:30'),('Prepared meal','2:00 - 3:00')]):
        z=.282-n*.010
        text_obj('Guide_'+str(n),label,cx-.026,label_y-.00015,z,.0026,align='LEFT',basis='engineering_completion')
        text_obj('Guide_Value_'+str(n),value,cx+.026,label_y-.00015,z,.0025,align='RIGHT',basis='engineering_completion')
        box('Guide_Rule_'+str(n),(cx,label_y-.00015,z-.004),(.054,.0001,.00015),'print',radius=0,basis='engineering_completion')
    for n,line in enumerate(['OPERATING INSTRUCTIONS','1. Place food inside oven.','2. Close the door securely.','3. Turn dial to set time.','','Use microwave-safe containers.','Clean surfaces after use.','','COMMERCIAL USE ONLY']):
        text_obj('Instruction_'+str(n),line,cx-.027,label_y-.00015,.151-n*.0075,.0024 if n else .0027,align='LEFT',bold=n==0,basis='engineering_completion')
    # Rear grille and service fasteners are intentionally marked inferred.
    for n in range(12):
        # Small real slots through back sheet.
        hole=plate('_rear_cutter',-.086+n*.015,.262,.006,.052,.002,.214,.018,None,basis='engineering_completion')
        cut(shell,hole)
    for x in [-.259,.259]:
        for z in [.040,.321]:cyl(f'Rear_Screw_{x}_{z}',(x,.224,z),.0026,.0012,'steel',axis='Y',basis='engineering_completion')
    seal_boolean_corner_sliver(shell)

def build_interior():
    i=P['interior'];back=i['back_y']
    # Two receiver apertures at the body lip, only their approximate positions are inferred.
    for z in [.115,.275]:
        plate(f'Latch_Receiver_{z}',.162,z,.010,.019,.002,i['front_y']-.0003,.0002,'black',basis='engineering_completion')
    # Back panel vent perforations inside cavity, rendered as a real small mesh.
    for row in range(4):
        for col in range(10):
            cyl(f'Interior_Vent_{row}_{col}',(-.10+col*.009,back-.0011,.232+row*.008),.0015,.0002,'black',axis='Y',basis='engineering_completion',vertices=12)

def build_screen():
    q=P['window'];cx=q['center_x'];cz=q['center_z'];w=q['glass_width'];h=q['glass_height'];p=q['mesh_pitch'];r=q['mesh_hole_radius']
    verts=[];faces=[];holes=0
    # Octagonal through holes with explicit connecting web: no opaque image plane.
    outer=[(p/2,p/2),(0,p/2),(-p/2,p/2),(-p/2,0),(-p/2,-p/2),(0,-p/2),(p/2,-p/2),(p/2,0)]
    for row in range(int(h/p)-2):
        z=cz+(row-(int(h/p)-3)/2)*p
        for col in range(int(w/p)-2):
            x=cx+(col-(int(w/p)-3)/2)*p
            dx=max(abs(x-cx)-(w/2-q['glass_radius']),0);dz=max(abs(z-cz)-(h/2-q['glass_radius']),0)
            if dx*dx+dz*dz>(q['glass_radius']-.001)**2:continue
            base=len(verts)
            verts += [(x+ox,-.2446,z+oz) for ox,oz in outer]
            verts += [(x+r*math.cos(math.pi/4+k*math.pi/4),-.2446,z+r*math.sin(math.pi/4+k*math.pi/4)) for k in range(8)]
            for k in range(8):faces.append((base+k,base+(k+1)%8,base+8+(k+1)%8,base+8+k))
            holes+=1
    obj=mesh('Door_Perforated_SafetyScreen',verts,faces,'screen',door)
    obj['through_hole_count']=holes;obj['pitch_m']=p;obj['hole_radius_m']=r
    plate('Door_Outer_Glass',cx,cz,w,h,q['glass_radius'],-.2465,.0013,'glass',door)
    plate('Door_Inner_Glass',cx,cz,w+.004,h+.004,q['glass_radius'],-.231,.0013,'glass',door)

def build_door():
    d=P['door'];q=P['window'];cx=(d['left']+d['right'])/2;cz=(d['bottom']+d['top'])/2;w=d['right']-d['left'];h=d['top']-d['bottom'];f=d['front_y']
    outer=(cx,cz,w,h,d['corner_radius']);opening=(q['center_x'],q['center_z'],q['bezel_width'],q['bezel_height'],q['bezel_radius'])
    rounded_panel('Door_Stainless_Frame',outer,opening,f,d['thickness'],d['edge_radius_m'],'door_steel',door)
    ring('Door_Silver_Window_Reveal',(opening[0],opening[1],opening[2]+.003,opening[3]+.003,opening[4]+.0015),opening,f-.0006,.002,'handle_steel',door)
    inner=(q['center_x'],q['center_z'],q['glass_width'],q['glass_height'],q['glass_radius'])
    ring('Door_Charcoal_Window_Bezel',opening,inner,f-.0010,.010,'bezel',door)
    ring('Door_Inside_ChokeFrame',(cx,cz,w-.012,h-.014,.006),(q['center_x'],q['center_z'],q['glass_width']+.008,q['glass_height']+.008,.010),f+.019,.004,'black',door,'engineering_completion')
    ring('Door_Perimeter_Seal',(cx,cz,w-.008,h-.008,.005),(cx,cz,w-.016,h-.016,.004),f+.020,.003,'black',door,'engineering_completion')
    build_screen()
    hp=P['handle'];x=hp['x'];z=hp['z'];hy=hp['front_y'];ln=hp['length']
    # Rear dark spine and bright cylindrical grip, with two sculpted die-cast feet.
    box('Handle_Rear_Inlay',(x,hy+.007,z),(.023,.012,ln-.010),'black',door,.005)
    cyl('Handle_Brushed_Grip',(x,hy-.001,z),hp['radius'],ln-.012,'handle_steel',door)
    for side in [-1,1]:
        zz=z+side*ln/2
        mount=box('Handle_Bottom_Mount' if side<0 else 'Handle_Top_Mount',(x-.003,(hy+f)/2,zz),(hp['mount_width'],hp['mount_depth'],hp['mount_height']),'door_steel',door,.007)
        box('Handle_Mount_Gasket_'+str(side),(x-.004,f-.0007,zz),(.034,.003,.025),'black',door,.004)
    # Visible left hinge seam; inferred internal knuckles and pin provide a coherent editing pivot.
    for z in [.072,.318]:
        cyl('Hinge_Pin_'+str(z),(d['left']+.004,-.226,z),.003,.026,'steel',body,basis='engineering_completion')
        cyl('Door_Hinge_Knuckle_'+str(z),(d['left']+.004,-.226,z),.0048,.018,'black',door,basis='engineering_completion')
    for z in [.115,.275]:
        box('Door_Latch_Hook_'+str(z),(.161,-.214,z),(.007,.019,.009),'black',door,.0015,'engineering_completion')

def build_knob():
    c=P['control'];x=(c['left']+c['right'])/2;z=c['knob_z'];r=c['knob_radius'];f=c['front_y']+c['panel_recess_m']
    cyl('Dial_Shadow_Ring',(x,f-.0025,z),r+.0035,.004,'black',body,'Y')
    cyl('Dial_Knurled_Body',(x,f-.0125,z),r,.017,'black',knob,'Y')
    cyl('Dial_Stainless_Cap',(x,f-.0215,z),r-.0014,.0035,'handle_steel',knob,'Y')
    for n in range(40):
        a=n*math.tau/40
        rib=box('Dial_Grip_Rib_%02d'%n,(x+r*math.sin(a),f-.0135,z+r*math.cos(a)),(.0011,.011,.0013),'black',knob,.0003)
        rib.rotation_euler[1]=a
    marker=box('Dial_Indicator',(x-.006,f-.0235,z+.010),(.0014,.0005,.009),'black',knob,.0005)
    marker.rotation_euler[1]=-.5
    for n in range(21):
        a=math.radians(-142+n*14.2);rad=r+.007
        tick=box('Timer_Tick_%02d'%n,(x+rad*math.sin(a),f-.00015,z+rad*math.cos(a)),(.0005,.0001,.003 if n%2==0 else .0017),'print',radius=0)
        tick.rotation_euler[1]=a
    for n,lab in enumerate(['0','1','2','3','4','5','6']):
        a=math.radians(-140+n*46.666);rad=r+.013
        text_obj('Timer_Number_'+lab,lab,x+rad*math.sin(a),f-.00015,z+rad*math.cos(a),.003,'print')

def studio():
    profile=[(-10,-.001),(1.2,-.001)]
    for n in range(1,49):
        a=n*math.pi/96;profile.append((1.2+1.3*math.sin(a),1.3*(1-math.cos(a))-.001))
    profile.append((2.5,10))
    verts=[(x,y,z) for y,z in profile for x in [-10,10]]
    floor=mesh('Studio_Cyclorama',verts,[(2*n,2*n+1,2*n+3,2*n+2) for n in range(len(profile)-1)],'ceramic',basis='presentation')
    for poly in floor.data.polygons:poly.use_smooth=True
    parts.remove(floor);floor.parent=None;relocate(floor,studio_col)
    floor.data.materials.clear()
    floor.data.materials.append(material('Studio warm grey',{'color':(.20,.22,.235),'metallic':0,'roughness':.58}))
    def area(name,loc,power,size,target,shape='DISK',size_y=None):
        data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape=shape;data.size=size
        if size_y is not None:data.size_y=size_y
        obj=bpy.data.objects.new(name,data);studio_col.objects.link(obj);obj.location=loc
        obj.rotation_euler=(Vector(target)-obj.location).to_track_quat('-Z','Y').to_euler()
    area('Softbox large left',(-.65,-.70,1.15),65,.85,(0,0,.15),'RECTANGLE',.65)
    area('Softbox front right',(.70,-.85,.62),38,.65,(0,-.15,.17),'RECTANGLE',.9)
    area('Top strip reflection',(.10,.25,1.0),48,.7,(0,0,.15),'RECTANGLE',.25)
    area('Left low card',(-.80,.10,.42),22,.60,(0,0,.20))
    world=bpy.data.worlds.new('Studio ambient');scene.world=world;world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.28,.31,.35,1)
    world.node_tree.nodes['Background'].inputs[1].default_value=.32
    cam_data=bpy.data.cameras.new('Photo matched camera');cam=bpy.data.objects.new('Camera_Reference',cam_data);studio_col.objects.link(cam)
    cam.location=(-1.10,-1.95,.49);target=Vector((0,-.005,.177));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    cam_data.type='PERSP';cam_data.lens=76;cam_data.clip_start=.01;cam_data.clip_end=500
    scene.camera=cam
    scene.render.engine='CYCLES';scene.cycles.samples=args.samples;scene.cycles.use_denoising=True
    scene.cycles.max_bounces=8;scene.cycles.transparent_max_bounces=8
    try:
        prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
        gpu=False
        for dev in prefs.devices:
            dev.use=dev.type!='CPU';gpu=gpu or dev.use
        if gpu:scene.cycles.device='GPU'
    except Exception as exc:print('GPU fallback',repr(exc))
    scene.render.resolution_x=args.resolution;scene.render.resolution_y=round(args.resolution*.72);scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX';scene.view_settings.look='AgX - Medium High Contrast';scene.view_settings.exposure=-.45
    scene.render.image_settings.file_format='PNG'
    scene.render.film_transparent=False
    return cam

build_cabinet();build_interior();build_door();build_knob();cam=studio()
bpy.context.view_layer.update()
# Set an immediately useful viewport with all assemblies editable and millimetre details visible.
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
            area.spaces.active.clip_start=.001
            area.spaces.active.clip_end=100
            area.spaces.active.shading.type='MATERIAL'
bpy.ops.object.select_all(action='DESELECT')
door.select_set(True);bpy.context.view_layer.objects.active=door
reference=bpy.data.images.load(str(HERE/'reference/user_reference.png'));reference.use_fake_user=True;reference.pack()
bpy.ops.file.pack_all()
for fname in ['build.py','parameters.json','materials.json']:
    shutil.copy2(HERE/fname,OUT/fname)
shutil.copytree(HERE/'reference',OUT/'reference')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'microwave_solwave.blend'))
scene.render.filepath=str(OUT/'closed_reference.png');bpy.ops.render.render(write_still=True)
# Pure visual export: studio and lights are excluded. Explicit selected API.
bpy.ops.object.select_all(action='DESELECT')
for obj in asset_col.objects:obj.select_set(True)
usd_props=bpy.ops.wm.usd_export.get_rna_type().properties
kwargs={'filepath':str(OUT/'microwave_solwave_visual.usdc'),'selected_objects_only':True,'export_materials':True}
if 'generate_preview_surface' in usd_props:kwargs['generate_preview_surface']=True
if 'export_custom_properties' in usd_props:kwargs['export_custom_properties']=True
bpy.ops.wm.usd_export(**kwargs)
# Open state is explicitly an editing review pose and contains no animation/force claims.
door.rotation_euler.z=math.radians(-P['door_open_degrees'])
cam.location=(-.98,-1.75,.88);cam.rotation_euler=(Vector((-.075,-.14,.17))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.lens=52
scene['pose_note']='105 degree open editing pose. Not a physics simulation.'
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'microwave_solwave_open.blend'))
scene.render.filepath=str(OUT/'open_inspection.png');bpy.ops.render.render(write_still=True)
door.rotation_euler.z=0
cam.location=(0,-1.50,.215);cam.rotation_euler=(Vector((0,-.015,.180))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=.65
scene.render.filepath=str(OUT/'front_inspection.png');bpy.ops.render.render(write_still=True)
def sha(path):return hashlib.sha256(Path(path).read_bytes()).hexdigest()
manifest={'schema_version':'phyart.photo-model-build/1.0','asset_id':P['asset_id'],'blender_version':bpy.app.version_string,
    'revision':P['revision'],'revision_basis':P['revision_basis'],'parent_delivery':'outputs/solwave_reference_v002',
    'geometry_sha256':sha(OUT/'parameters.json'),'appearance_sha256':sha(OUT/'materials.json'),'script_sha256':sha(OUT/'build.py'),
    'reference_sha256':sha(OUT/'reference/user_reference.png'),'units':'m','front':'-Y','up':'Z',
    'part_object_count':len(parts),'parts':[{'name':o.name,'semantic_id':o.get('semantic_id'),'assembly':o.get('assembly_id'),'evidence':o.get('evidence_class'),'type':o.type} for o in parts],
    'source_templates_consulted':['templates/microwave/mw_diversity_v002/structure/schema.json','templates/microwave/appearance_v001/README.md','templates/microwave/mw_functional_v003/README.md'],
    'reuse_scope':'Parameter naming, geometry/material separation, semantic hierarchy and provenance conventions. No legacy product meshes or physics results reused.',
    'physics':{'status':'not_run','joint_count':0,'rigidbody_count':0,'claim':'Blender visual reconstruction only'},
    'limitations':['Absolute dimensions estimated; reference photo contains no scale.','Rear, interior, hinge and latch detail are engineering completion.','Small control legends are layout approximations.','USD Preview Surface does not reproduce procedural brushing exactly; Blender is authoritative appearance.'],
    'usd_export_options':kwargs}
(OUT/'build_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
print('BUILD_COMPLETE',OUT)
