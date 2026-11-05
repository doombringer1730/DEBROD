// Enums. Enum.Material.Neon, Enum.KeyCode.E, ... Each item is a unique
// object, so `input.KeyCode === Enum.KeyCode.E` works. Properties that take
// an enum also accept the item's name as a string ("Neon").

class EnumItem {
  constructor(type, name, value) {
    this.Name = name
    this.Value = value
    this.EnumType = type
  }
  toString() { return `Enum.${this.EnumType.name}.${this.Name}` }
}

class EnumType {
  constructor(name, names) {
    this.name = name
    this._items = names.map((n, i) => new EnumItem(this, n, i))
    for (const item of this._items) this[item.Name] = item
  }
  GetEnumItems() { return this._items.slice() }
  toString() { return `Enum.${this.name}` }
}

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const digits = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

export const Enum = {
  Material: new EnumType('Material', [
    'Plastic', 'SmoothPlastic', 'Neon', 'Glass', 'Wood', 'WoodPlanks', 'Metal', 'Brick',
    'Concrete', 'Grass', 'Sand', 'Slate', 'Ice', 'Marble', 'Granite', 'Fabric', 'ForceField',
  ]),
  PartType: new EnumType('PartType', ['Block', 'Ball', 'Cylinder', 'Wedge']),
  KeyCode: new EnumType('KeyCode', [
    'Unknown', ...letters, ...digits, 'Space', 'Return', 'Tab', 'Backspace', 'Escape', 'Delete',
    'LeftShift', 'RightShift', 'LeftControl', 'RightControl', 'LeftAlt', 'RightAlt',
    'Up', 'Down', 'Left', 'Right', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10',
    'F11', 'F12', 'Backquote', 'Minus', 'Equals', 'LeftBracket', 'RightBracket', 'Semicolon',
    'Quote', 'Comma', 'Period', 'Slash', 'BackSlash',
  ]),
  UserInputType: new EnumType('UserInputType', [
    'Keyboard', 'MouseButton1', 'MouseButton2', 'MouseButton3', 'MouseWheel', 'MouseMovement', 'Touch',
  ]),
  UserInputState: new EnumType('UserInputState', ['Begin', 'Change', 'End']),
  CameraType: new EnumType('CameraType', ['Custom', 'Scriptable', 'Fixed', 'Follow']),
  MouseBehavior: new EnumType('MouseBehavior', ['Default', 'LockCenter', 'LockCurrentPosition']),
  RaycastFilterType: new EnumType('RaycastFilterType', ['Exclude', 'Include', 'Blacklist', 'Whitelist']),
  HumanoidStateType: new EnumType('HumanoidStateType', [
    'Running', 'Jumping', 'Freefall', 'Landed', 'Dead', 'Physics', 'None',
  ]),
  Block: null, // filled in by voxels.js
}

export function defineEnum(name, names) {
  Enum[name] = new EnumType(name, names)
  return Enum[name]
}

// Accepts an EnumItem or a string and returns the item's name.
export function enumName(v) {
  if (v instanceof EnumItem) return v.Name
  return String(v)
}

export { EnumItem, EnumType }

const codeMap = {
  Space: 'Space', Enter: 'Return', NumpadEnter: 'Return', Tab: 'Tab', Backspace: 'Backspace',
  Escape: 'Escape', Delete: 'Delete', ShiftLeft: 'LeftShift', ShiftRight: 'RightShift',
  ControlLeft: 'LeftControl', ControlRight: 'RightControl', AltLeft: 'LeftAlt', AltRight: 'RightAlt',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Backquote: 'Backquote',
  Minus: 'Minus', Equal: 'Equals', BracketLeft: 'LeftBracket', BracketRight: 'RightBracket',
  Semicolon: 'Semicolon', Quote: 'Quote', Comma: 'Comma', Period: 'Period', Slash: 'Slash',
  Backslash: 'BackSlash',
}

// KeyboardEvent.code -> Enum.KeyCode item
export function keyCodeFromEvent(code) {
  if (code.startsWith('Key') && code.length === 4) return Enum.KeyCode[code[3]]
  if (code.startsWith('Digit')) return Enum.KeyCode[digits[+code[5]]]
  if (/^F\d+$/.test(code)) return Enum.KeyCode[code] || Enum.KeyCode.Unknown
  return Enum.KeyCode[codeMap[code]] || Enum.KeyCode.Unknown
}
