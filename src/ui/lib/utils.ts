import { clsx, type ClassValue } from 'clsx'

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

// Plugin message utilities for the new networking system
import { UI_CHANNEL } from "@ui/app.network";
import { PLUGIN } from "@common/networkSides";

export function postMessage(type: string, data?: any) {
  return UI_CHANNEL.emit(PLUGIN, type as any, data ? [data] : [])
}

export function requestMessage(type: string, data?: any) {
  return UI_CHANNEL.request(PLUGIN, type as any, data ? [data] : [])
}
