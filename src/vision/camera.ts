export async function openCamera(): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('This browser can’t use the camera here. Open the app over HTTPS or on localhost.')
  }
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
}

export function stopCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}

export function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : ''
  switch (name) {
    case 'NotAllowedError':
      return 'Camera access was blocked. Allow the camera for this site in your browser, then reload.'
    case 'NotFoundError':
      return 'No camera was found. Connect one and reload.'
    case 'NotReadableError':
      return 'The camera is being used by another app. Close it and reload.'
    default:
      return err instanceof Error ? err.message : String(err)
  }
}
