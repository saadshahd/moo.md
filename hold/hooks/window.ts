// The window programs are adapted from image-preview 0.2.2 (https://github.com/midudev/better-claude,
// plugins/image-preview/hooks/window.ts), MIT © Miguel Ángel Durán (midudev): changed to open where
// the hook places them and to close on their own. The licence is in ./window.LICENSE.
//
// Each shows a picture in a borderless window outside the terminal, one program a system, run
// with what it needs in the environment: HOLD_WINDOW_FILE, the PNG; HOLD_WINDOW_RECT, the window
// as `x y width height` from the top left of the main screen, in points; HOLD_WINDOW_LIFE, how
// many seconds at most it stays. Each writes `shown` once the window is up, or a line starting
// `error`, then a `.` a beat, and exits on a click on its window, when its parent goes, when
// nobody reads it, or at the end of its life. The window never takes the focus: the terminal
// keeps it.

/** A line in each window program and in no other, so `pkill -f` finds every window open. */
export const MARKER = "moo-hold-view-window";

/** The window's border round its picture, in points. */
export const PAD = 6;

/**
 * macOS: where the pointer is, and the room on the screen it is on, as Pointer's JSON. AppKit
 * counts from the main screen's bottom left; the JSON from its top left.
 */
export const MACOS_POINTER = String.raw`
ObjC.import('Cocoa')

function run () {
  const mouse = $.NSEvent.mouseLocation
  const screens = $.NSScreen.screens
  const top = screens.objectAtIndex(0).frame.size.height
  let screen = $.NSScreen.mainScreen
  for (let i = 0; i < screens.count; i++) {
    const frame = screens.objectAtIndex(i).frame
    if (mouse.x >= frame.origin.x && mouse.x < frame.origin.x + frame.size.width && mouse.y >= frame.origin.y && mouse.y < frame.origin.y + frame.size.height) screen = screens.objectAtIndex(i)
  }
  const area = screen.visibleFrame
  return JSON.stringify({
    x: mouse.x,
    y: top - mouse.y,
    area: { x: area.origin.x, y: top - area.origin.y - area.size.height, width: area.size.width, height: area.size.height },
    scale: screen.backingScaleFactor
  })
}
`;

/** Linux and other X11 desktops: the same, from Python's Tk; X11 counts pixels from the top left. */
export const LINUX_POINTER = String.raw`
import json
import tkinter as tk

root = tk.Tk()
root.withdraw()
x, y = root.winfo_pointerxy()
print(json.dumps({'x': x, 'y': y, 'area': {'x': 0, 'y': 0, 'width': root.winfo_screenwidth(), 'height': root.winfo_screenheight()}, 'scale': 1}))
`;

/**
 * macOS: JavaScript for Automation, run by `osascript`, drawing an AppKit panel.
 */
export const MACOS = String.raw`
// ${MARKER}
ObjC.import('Cocoa')
ObjC.import('unistd')

function run () {
  const env = $.NSProcessInfo.processInfo.environment
  const read = key => { const value = env.objectForKey(key); return value.isNil() ? '' : ObjC.unwrap(value) }
  const say = text => $.NSFileHandle.fileHandleWithStandardOutput.writeData($(text + '\n').dataUsingEncoding($.NSUTF8StringEncoding))
  const app = $.NSApplication.sharedApplication
  // An accessory app: no Dock icon, never the active one.
  app.setActivationPolicy(1)
  app.finishLaunching
  const image = $.NSImage.alloc.initWithContentsOfFile(read('HOLD_WINDOW_FILE'))
  if (image.isNil() || image.representations.count === 0) { say('error: cannot read the image'); return }
  const [x, y, width, height] = read('HOLD_WINDOW_RECT').split(' ').map(Number)
  if (!(width > 0 && height > 0)) { say('error: no place for the window'); return }
  const top = $.NSScreen.screens.objectAtIndex(0).frame.size.height
  const pad = ${PAD}
  // Borderless and non-activating; over every app window, on every space, full-screen ones too.
  const panel = $.NSPanel.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(x, top - y - height, width, height), 128, 2, false)
  panel.level = 25
  panel.hasShadow = true
  panel.opaque = false
  panel.backgroundColor = $.NSColor.clearColor
  panel.collectionBehavior = 1 | 16 | 256
  const backdrop = $.NSVisualEffectView.alloc.initWithFrame($.NSMakeRect(0, 0, width, height))
  backdrop.material = 13
  backdrop.state = 1
  backdrop.wantsLayer = true
  backdrop.layer.cornerRadius = 10
  backdrop.layer.masksToBounds = true
  const view = $.NSImageView.alloc.initWithFrame($.NSMakeRect(pad, pad, width - pad * 2, height - pad * 2))
  view.image = image
  view.imageScaling = 3
  backdrop.addSubview(view)
  panel.contentView = backdrop
  panel.orderFrontRegardless
  say('shown')
  const parent = $.getppid()
  const end = Date.now() + Number(read('HOLD_WINDOW_LIFE')) * 1000
  while (Date.now() < end && $.getppid() === parent) {
    const event = app.nextEventMatchingMaskUntilDateInModeDequeue($.NSEventMaskAny, $.NSDate.dateWithTimeIntervalSinceNow(0.1), $.NSDefaultRunLoopMode, true)
    // Only a click on the panel reaches this app: a left or right mouse-down closes it.
    if (!event.isNil()) {
      if (event.type === 1 || event.type === 3) return
      app.sendEvent(event)
    }
    say('.')
  }
}
`;

/** Linux and other X11 desktops: Python's Tk, an undecorated tooltip window. */
export const LINUX = String.raw`
# ${MARKER}
import math, os, sys
try:
    import tkinter as tk
except ImportError:
    print('error: no tkinter', flush=True)
    sys.exit(1)

life = float(os.environ['HOLD_WINDOW_LIFE'])
try:
    x, y, width, height = (int(float(v)) for v in os.environ.get('HOLD_WINDOW_RECT', '').split())
except ValueError:
    print('error: no place for the window', flush=True)
    sys.exit(1)
try:
    root = tk.Tk()
except tk.TclError as error:
    print('error: no display: %s' % error, flush=True)
    sys.exit(1)
root.withdraw()
root.overrideredirect(True)
for name, value in (('-topmost', True), ('-type', 'tooltip')):
    try:
        root.attributes(name, value)
    except tk.TclError:
        pass
try:
    image = tk.PhotoImage(file=os.environ.get('HOLD_WINDOW_FILE', ''))
except tk.TclError:
    print('error: cannot read the image', flush=True)
    sys.exit(1)
pad = ${PAD}
step = max(1, math.ceil(max(image.width() / max(1, width - pad * 2), image.height() / max(1, height - pad * 2))))
if step > 1:
    image = image.subsample(step)
root.configure(background='#202020')
tk.Label(root, image=image, borderwidth=0, highlightthickness=0, background='#202020').pack(padx=pad, pady=pad)
root.geometry('%dx%d+%d+%d' % (width, height, x, y))
root.bind('<ButtonPress>', lambda event: root.destroy())
root.deiconify()
root.update_idletasks()
print('shown', flush=True)
parent = os.getppid()


def beat():
    if os.getppid() != parent:
        root.destroy()
        return
    try:
        print('.', flush=True)
    except (BrokenPipeError, OSError):
        # Nobody reads: end, the pipe's last flush going nowhere.
        os.dup2(os.open(os.devnull, os.O_WRONLY), sys.stdout.fileno())
        root.destroy()
        return
    root.after(100, beat)


beat()
root.after(int(life * 1000), root.destroy)
root.mainloop()
`;
