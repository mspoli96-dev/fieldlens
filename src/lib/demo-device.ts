export type DemoDeviceState = {
  paperLoaded: boolean;
  coverClosed: boolean;
  usbConnected: boolean;
  printed: boolean;
};

export type DemoDeviceAction = "paper" | "cover" | "usb" | "test_print" | "reset";

export const INITIAL_DEVICE: DemoDeviceState = {
  paperLoaded: false,
  coverClosed: false,
  usbConnected: false,
  printed: false,
};

export function canPrint(device: DemoDeviceState): boolean {
  return device.paperLoaded && device.coverClosed && device.usbConnected;
}

export function updateDevice(device: DemoDeviceState, action: DemoDeviceAction): DemoDeviceState {
  if (action === "reset") return { ...INITIAL_DEVICE };
  if (action === "test_print") return canPrint(device) ? { ...device, printed: true } : device;
  const key = action === "paper" ? "paperLoaded" : action === "cover" ? "coverClosed" : "usbConnected";
  return { ...device, [key]: !device[key], printed: false };
}
