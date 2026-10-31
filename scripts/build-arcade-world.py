"""Original Arcadia assets. Run with Blender 4.5 --background --python this file.
No external models/textures. GLBs retain semantic object names for web animation.
"""
import bpy, math, os, random, sys
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(73)

def mat(name, hexcode, metal=0, rough=.3, emission=0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    rgb = [int(hexcode[i:i+2],16)/255 for i in (0,2,4)]
    rgb = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb,1)
    p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    p.inputs['Emission Color'].default_value = (*rgb,1); p.inputs['Emission Strength'].default_value = emission
    return m

def finish(o, name, material, bevel=0):
    o.name = name; o.data.materials.append(material)
    if bevel:
        b=o.modifiers.new('Soft arcade edges','BEVEL'); b.width=bevel; b.segments=3
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=b.name)
    for p in o.data.polygons: p.use_smooth=True
    return o

def box(name, p, size, material, bevel=.12):
    bpy.ops.mesh.primitive_cube_add(size=1, location=p); o=bpy.context.object; o.dimensions=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o,name,material,bevel)

def orb(name,p,r,material,scale=(1,1,1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=r,location=p)
    o=bpy.context.object; o.scale=scale; return finish(o,name,material)

def cyl(name,p,r,depth,material,vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=depth,location=p)
    return finish(bpy.context.object,name,material,.07)

def ring(name,p,r,thick,material,rot=(math.pi/2,0,0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r,minor_radius=thick,major_segments=48,minor_segments=10,location=p,rotation=rot)
    return finish(bpy.context.object,name,material)

def text(name,body,p,size,material):
    bpy.ops.object.text_add(location=p,rotation=(math.pi/2,0,0)); o=bpy.context.object
    o.name=name; o.data.body=body; o.data.align_x='CENTER'; o.data.align_y='CENTER'; o.data.size=size; o.data.extrude=.015; o.data.bevel_depth=.006
    o.data.materials.append(material); bpy.ops.object.convert(target='MESH'); return o

def star(p,r,material,name='Collectible'):
    verts=[]
    for y in [-.09,.09]:
        for i in range(10):
            a=i*math.pi/5+math.pi/2; rr=r if i%2==0 else r*.48
            verts.append((p[0]+rr*math.cos(a),p[1]+y,p[2]+rr*math.sin(a)))
    faces=[tuple(range(9,-1,-1)),tuple(range(10,20))]+[(i,(i+1)%10,(i+1)%10+10,i+10) for i in range(10)]
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(o); return finish(o,name,material,.045)

def island(x=0,y=0,z=0,s=1):
    cyl('Island violet rim',(x,y,z),2.55*s,.42*s,VIOLET)
    cyl('Island blue underside',(x,y,z-.3*s),2.3*s,.5*s,BLUE)
    cyl('Island pale top',(x,y,z+.23*s),2.46*s,.18*s,PALE)
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=.75*s,radius2=2.12*s,depth=1.3*s,location=(x,y,z-.95*s))
    finish(bpy.context.object,'Floating rock',LILAC,.13*s)
    for i in range(5):
        a=i*1.25
        orb('Grass bud',(x+math.cos(a)*2.15*s,y+math.sin(a)*2.15*s,z+.46*s),.19*s,MINT,(1,1,1.6))

def cloud(x,y,z,s):
    for dx,dy,dz,r in [(-.45,0,0,.45),(0,0,.12,.62),(.5,0,0,.4),(.05,-.2,-.1,.42)]:
        orb('Cloud',(x+dx*s,y+dy*s,z+dz*s),r*s,WHITE,(1,1,.7))

def portal():
    island()
    box('Portal foot',(0,.25,.57),(2.7,1.55,.55),INK,.22)
    box('Arcade cabinet',(0,.55,1.95),(2.35,.9,2.7),VIOLET,.3)
    box('Screen inset',(0,.02,2.1),(1.95,.17,2.05),INK,.2)
    ring('Portal rim',(0,-.1,2.55),1.18,.21,VIOLET)
    ring('Portal light',(0,-.26,2.55),.96,.07,MINT_GLOW)
    disk=cyl('Portal interior',(0,-.03,2.55),.98,.08,BLUE); disk.rotation_euler=(math.pi/2,0,0)
    ring('Portal inner ring',(0,-.105,2.55),.75,.025,LILAC)
    # An extruded Gateway A: rounded arch, crossbar, and open lower doorway.
    # It is geometry rather than a flat logo texture, so light catches its rim.
    points=[]
    for i in range(33):
        a=math.pi-i*math.pi/32
        points.append((.57*math.cos(a),.14+.57*math.sin(a)))
    points += [(.57,-.65),(.29,-.65),(.29,-.18),(-.29,-.18),(-.29,-.65),(-.57,-.65)]
    curve=bpy.data.curves.new('Gateway A silhouette','CURVE'); curve.dimensions='2D'; curve.resolution_u=2
    curve.extrude=.075; curve.bevel_depth=.024; curve.bevel_resolution=3
    outline=curve.splines.new('POLY'); outline.points.add(len(points)-1)
    for point,(x,y) in zip(outline.points,points): point.co=(x,y,0,1)
    outline.use_cyclic_u=True
    inner=[]
    for i in range(25):
        a=i*math.pi/24
        inner.append((.29*math.cos(a),.14+.29*math.sin(a)))
    inner += [(-.29,.02),(.29,.02)]
    hole=curve.splines.new('POLY'); hole.points.add(len(inner)-1)
    for point,(x,y) in zip(hole.points,inner): point.co=(x,y,0,1)
    hole.use_cyclic_u=True
    emblem=bpy.data.objects.new('Gateway A portal emblem',curve); bpy.context.collection.objects.link(emblem)
    emblem.location=(0,-.29,2.55); emblem.rotation_euler=(math.pi/2,0,0); curve.materials.append(WHITE)
    bpy.context.view_layer.objects.active=emblem; emblem.select_set(True); bpy.ops.object.convert(target='MESH')
    box('Control console',(0,-.6,1.03),(2,.8,.35),LILAC,.15)
    cyl('Joystick stem',(-.5,-.6,1.35),.04,.32,INK)
    orb('Joystick',(-.5,-.6,1.57),.15,CORAL)
    for x,ma in [(.3,GOLD),(.65,MINT)]: cyl('Arcade button',(x,-.65,1.27),.11,.08,ma)
    for i in range(3): box('Entry step',(0,-1.5-i*.3,.36-i*.1),(1.8,.4,.13),WHITE,.045)
    star((-2.7,.3,2.3),.38,GOLD,'Orbit star')
    star((2.6,.8,3.6),.27,MINT,'Orbit mint')
    island(3.35,1.3,.15,.36); star((3.35,1.3,1.1),.35,GOLD)
    island(-3.35,1.7,.65,.29); orb('Blue collectible',(-3.35,1.7,1.5),.28,BLUE)
    cloud(-3,-.3,-.5,1.3); cloud(2.6,2.6,1.6,1.15)

def trophy():
    island()
    box('Trophy pedestal',(0,0,.65),(1.8,1.4,.7),VIOLET,.2)
    box('Trophy plaque',(0,-.725,.68),(.75,.045,.25),GOLD,.04)
    cyl('Trophy foot',(0,0,1.12),.55,.18,GOLD)
    cyl('Trophy stem',(0,0,1.47),.15,.65,GOLD)
    # Open bowl, hollow lathed profile
    profile=[(.2,1.7),(.6,1.8),(.87,2.3),(.98,2.95),(.84,2.95),(.74,2.32),(.5,1.96),(.2,1.9)]
    verts=[(r*math.cos(i*math.tau/48),r*math.sin(i*math.tau/48),z) for r,z in profile for i in range(48)]
    faces=[(j*48+i,j*48+(i+1)%48,(j+1)*48+(i+1)%48,(j+1)*48+i) for j in range(len(profile)-1) for i in range(48)]
    mesh=bpy.data.meshes.new('Cup'); mesh.from_pydata(verts,[],faces); mesh.update(); o=bpy.data.objects.new('Golden cup',mesh); bpy.context.collection.objects.link(o); finish(o,'Golden cup',GOLD)
    for x in [-.99,.99]:
        o=ring('Trophy handle',(x,0,2.42),.48,.095,GOLD); o.scale=(.75,1,1)
    star((0,-.84,2.45),.32,PALE)
    for i in range(3):
        a=i*2.1; x=math.sin(a)*2; y=math.cos(a)*1.4
        cyl('Player marker',(x,y,.48),.33,.15,[MINT,CORAL,BLUE][i]); orb('Player avatar',(x,y,.84),.23,[MINT,CORAL,BLUE][i])
    star((-2.4,1.5,2.8),.28,MINT); star((2.2,1.4,3.4),.22,GOLD)
    cloud(-2.7,1,-.1,1.05)

def chest():
    island()
    box('Chest body',(0,0,1.03),(2.4,1.6,1.45),VIOLET,.25)
    for x in [-.88,.88]: box('Gold chest band',(x,-.84,1.1),(.2,.09,1.3),GOLD,.05)
    lid=box('Chest lid',(0,.48,2.04),(2.5,1.65,.5),VIOLET,.22); lid.rotation_euler.x=math.radians(-38)
    box('Chest lock',(0,-.9,1.4),(.5,.18,.55),GOLD,.09)
    text('XP label','XP',(0,-1,1.42),.25,INK)
    for i,(x,y,z) in enumerate([(-.8,-.1,2.35),(.3,.1,2.55),(1,-.1,3.0),(-.5,.2,3.4),(.4,.5,3.75)]):
        o=cyl('XP coin '+str(i),(x,y,z),.28,.1,GOLD); o.rotation_euler=(math.pi/2,0,.2*i)
        star((x,y-.075,z),.14,PALE)
    star((-2,0,2.4),.32,MINT); cloud(2.8,1.5,.25,1.1)

def podium():
    island()
    for rank,x,h,ma in [(2,-1.3,1.1,BLUE),(1,0,1.75,VIOLET),(3,1.3,.8,CORAL)]:
        box('Podium '+str(rank),(x,0,.35+h/2),(1.18,1.35,h),ma,.14)
        text('Place '+str(rank),str(rank),(x,-.7,.35+h/2),.6,WHITE)
        cyl('Avatar base',(x,0,.45+h),.37,.12,GOLD if rank==1 else PALE)
        orb('Podium avatar',(x,0,.85+h),.35,MINT if rank==1 else LILAC)
        for dx in [-.11,.11]: orb('Avatar eye',(x+dx,-.33,.91+h),.04,INK)
    star((0,0,3.65),.38,GOLD); cloud(-2.7,1.6,.3,1)

def quiz():
    island()
    card=box('Question card',(0,.35,2),(2.75,.28,2.6),WHITE,.22)
    text('Question mark','?',(0,.15,2.4),1.4,VIOLET)
    for i in range(2): box('Answer pill',(0,-.1,1.5-i*.43),(1.9,.22,.3),MINT if i==0 else LILAC,.1)
    star((2,0,3),.28,GOLD); cloud(-2.6,1.4,.4,1.1)

for kind,build in [('portal',portal),('trophy',trophy),('chest',chest),('podium',podium),('quiz',quiz)]:
    if '--only' in sys.argv and sys.argv[sys.argv.index('--only')+1] != kind: continue
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
    VIOLET=mat('Arcade Violet','7564F6',.15); BLUE=mat('Electric Blue','2D83F7',.1)
    MINT=mat('Mint Pop','55E6A5',.1); MINT_GLOW=mat('Portal mint light','83FFCF',0,.25,.9)
    GOLD=mat('Prize Gold','FFC857',.55,.22); CORAL=mat('Coral','FF7A70',.1)
    INK=mat('Ink Navy','17182B',.1); LILAC=mat('Soft lavender','B4AAF9',.05,.4)
    WHITE=mat('Porcelain','FFFCF4',.05,.25); PALE=mat('Island surface','DCD7FF',.05,.4)
    build()
    # Export only scene geometry, with lights separately authored on the web.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models',kind+'.glb'),export_format='GLB',use_selection=True,export_yup=True,export_cameras=False,export_lights=False,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
    if '--resume' in sys.argv and os.path.exists(os.path.join(ROOT,'public/world',kind+'.png')): continue
    scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32; scene.cycles.use_denoising=True
    scene.render.resolution_x=1000; scene.render.resolution_y=860; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=True
    scene.world.color=(.28,.28,.28)
    scene.view_settings.view_transform='AgX'
    for name,p,power,size,color in [('Key',(-3,-5,9),1500,7,(1,.9,.82)),('Fill',(5,-2,5),1050,6,(.64,.73,1)),('Rim',(0,5,7),1700,5,(.88,.78,1))]:
        bpy.ops.object.light_add(type='AREA',location=p); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.data.color=color
        o.rotation_euler=(Vector((0,0,1))-o.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add(location=(7,-12,8)); camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,1.05))-camera.location).to_track_quat('-Z','Y').to_euler(); camera.data.type='ORTHO'; camera.data.ortho_scale=9.7 if kind=='portal' else 7.6; scene.camera=camera
    scene.render.filepath=os.path.join(ROOT,'public/world',kind+'.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'.data/tools','arcadia-'+kind+'.blend'))
print('Arcadia: five original GLBs and fallback renders complete.')
