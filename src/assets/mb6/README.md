# Imported latch assembly

Reference: user-provided MB6_Ferrolho_Alavanca.stl, explicitly exported unlocked.
The combined file contains the unchanged 220-triangle support, a 92-triangle slider and a 202-triangle handle. The latter two were isolated without altering their coordinates.

Support registration: XY center (502.49591064453125, 391.4358215332031) mm, rear Z=0. Conversion to app meters retains the existing rear-face depth of -7 mm.

Unlocked slider center relative to support: (-10, 10, 20) mm; envelope 120 x 6 x 6 mm. No additional slider offset is applied. This is 27 mm left of the previous published unlocked position; the supplied geometry takes precedence over the approximate request to reduce the previous offset by 20 mm. Travel remains +38 mm toward the receiver.

Handle envelope: 30 x 118 x 2 mm. Inferred pivot is center of the upper stem edge, (-56, 6, 21) mm relative to support registration. The STL contains no joint metadata; this pivot is an integration assumption, not a measured hinge. At rest, the mesh reproduces the submitted assembly exactly. Opening remains 66 degrees about horizontal X. Handle and slider translate together. Opposite latches mirror X.

Both movable components and support retain edge outlines. Physical clearances are not certified by the application state-machine tests.
