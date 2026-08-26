import { useCallback, useEffect, useRef, useState } from 'react';
import Cropper from 'react-easy-crop';
import useImageCapture from '../hooks/useImageCapture';

function UniversalImageEditor({
  open,
  onClose,
  onSave,
  ariaLabel = 'Image editor'
}) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [mode, setMode] = useState(null);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const cropLastTapRef = useRef(0);

  const {
    videoRef,
    cameraOpen,
    cameraError,
    capturedImage,
    crop,
    zoom,
    croppedAreaPixels,
    setCrop,
    setZoom,
    setCroppedAreaPixels,
    openCamera,
    switchCamera,
    capturePhoto,
    selectImage,
    createCroppedBlob,
    stopCamera,
    resetImageState
  } = useImageCapture();

  const resetEditor = useCallback(() => {
    stopCamera();
    resetImageState();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsEditorOpen(false);
    setMode(null);
    setError('');
    setIsSaving(false);
    cropLastTapRef.current = 0;
  }, [
    resetImageState,
    setCrop,
    setCroppedAreaPixels,
    setZoom,
    stopCamera
  ]);

  useEffect(() => {
    if (!open) {
      resetEditor();
    }
  }, [open, resetEditor]);

  if (!open) {
    return null;
  }

  const handleClose = () => {
    resetEditor();
    onClose?.();
  };

  const openCameraEditor = async () => {
    setError('');
    setMode('camera');
    resetImageState();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsEditorOpen(true);

    const opened = await openCamera();

    if (!opened) {
      setError('Unable to open the camera. Please try again.');
    }
  };

  const openUploadEditor = async () => {
    setError('');
    setMode('upload');
    resetImageState();

    const result = await selectImage();

    if (!result) {
      setError(
        'Unable to open the selected image. Please try again.'
      );
      return;
    }

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsEditorOpen(true);
  };

  const handleRetake = async () => {
    setError('');
    setMode('camera');
    resetImageState();
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setIsEditorOpen(true);

    const opened = await openCamera();

    if (!opened) {
      setError('Unable to open the camera. Please try again.');
    }
  };

  const handleReUpload = async () => {
    setError('');
    setMode('upload');
    stopCamera();
    resetImageState();

    const result = await selectImage();

    if (!result) {
      setError(
        'Unable to open the selected image. Please try again.'
      );
      return;
    }

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleCapture = () => {
    const imageData = capturePhoto();

    if (!imageData) {
      return;
    }

    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
  };

  const handleSave = async () => {
    if (!capturedImage || !croppedAreaPixels || isSaving) {
      return;
    }

    try {
      setError('');
      setIsSaving(true);

      const croppedBlob = await createCroppedBlob(
        capturedImage,
        croppedAreaPixels,
        'image/jpeg',
        0.92
      );

      await onSave?.({
        blob: croppedBlob,
        source: mode
      });

      resetEditor();
      onClose?.();
    } catch (saveError) {
      console.error('Image save failed:', saveError);

      setError(
        saveError?.message ||
          'Failed to save the image. Please try again.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditorBackdrop = (event) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    resetEditor();
    setMode(null);
  };

  return (
    <>
      {!isEditorOpen && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm"
          onClick={handleClose}
          role="presentation"
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-gray-900/90 p-3 shadow-2xl backdrop-blur-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
          >
            <button
              type="button"
              onClick={openCameraEditor}
              className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-4 text-left text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              <span>Take Photo</span>
              <span className="text-white/80">›</span>
            </button>

            <button
              type="button"
              onClick={openUploadEditor}
              className="mt-2 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-indigo-500 to-blue-500 px-4 py-4 text-left text-sm font-black text-white shadow-lg shadow-blue-500/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              <span>Upload from Device</span>
              <span className="text-white/80">›</span>
            </button>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/70 px-3 py-3 sm:p-4"
          onMouseDown={handleEditorBackdrop}
          role="presentation"
        >
          <div
            className="w-full max-h-[94vh] max-w-md overflow-hidden rounded-2xl border border-gray-800 bg-gray-950 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label={`${ariaLabel} editor`}
          >
            <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2.5 sm:px-4 sm:py-3">
              <h2 className="text-sm font-black text-white sm:text-base">
                {capturedImage ? 'Edit Photo' : 'Take Photo'}
              </h2>

              <button
                type="button"
                onClick={() => {
                  resetEditor();
                  onClose?.();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold text-gray-400 transition hover:bg-gray-800 hover:text-white sm:h-9 sm:w-9 sm:text-xl"
                aria-label={`Close ${ariaLabel} editor`}
              >
                ×
              </button>
            </div>

            <div className="space-y-2.5 px-2.5 py-2.5 sm:space-y-4 sm:px-3 sm:py-3">
              {!capturedImage ? (
                <>
                  {error || cameraError ? (
                    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-6 text-center">
                      <p className="text-sm font-bold text-red-300">
                        {error || cameraError}
                      </p>

                      {mode === 'camera' && (
                        <button
                          type="button"
                          onClick={handleRetake}
                          className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-black text-white transition hover:bg-orange-600"
                        >
                          Retry Camera
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="mx-auto h-[42vh] max-h-[300px] min-h-[220px] w-full max-w-[300px] overflow-hidden rounded-xl bg-black">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-1.5 pb-1.5 pt-2 sm:gap-3 sm:px-3 sm:pb-3 sm:pt-3">
                    <button
                      type="button"
                      onClick={switchCamera}
                      disabled={Boolean(error || cameraError)}
                      className="rounded-xl border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-black text-white transition hover:bg-gray-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm"
                      aria-label="Switch camera"
                    >
                      Switch
                    </button>

                    <button
                      type="button"
                      disabled={
                        Boolean(error || cameraError) ||
                        !cameraOpen
                      }
                      onClick={handleCapture}
                      className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-black text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      Capture
                    </button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div
                    className="relative mx-auto h-[42vh] max-h-[300px] min-h-[220px] w-full max-w-[300px] overflow-hidden rounded-2xl bg-black"
                    onTouchEnd={(event) => {
                      if (event.changedTouches.length !== 1) {
                        return;
                      }

                      const now = Date.now();

                      if (
                        now - cropLastTapRef.current <
                        300
                      ) {
                        setZoom((currentZoom) =>
                          currentZoom >= 2 ? 1 : 2
                        );
                        cropLastTapRef.current = 0;
                        return;
                      }

                      cropLastTapRef.current = now;
                    }}
                  >
                    <Cropper
                      image={capturedImage}
                      crop={crop}
                      zoom={zoom}
                      aspect={1}
                      cropShape="rect"
                      showGrid
                      objectFit="contain"
                      zoomWithScroll={false}
                      onCropChange={setCrop}
                      onCropComplete={(_, nextAreaPixels) =>
                        setCroppedAreaPixels(nextAreaPixels)
                      }
                      onZoomChange={setZoom}
                      onDoubleClick={() => {
                        setZoom((currentZoom) =>
                          currentZoom >= 2 ? 1 : 2
                        );
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-1.5 pb-1.5 pt-2 sm:gap-3 sm:px-3 sm:pb-3 sm:pt-3">
                    <button
                      type="button"
                      onClick={
                        mode === 'upload'
                          ? handleReUpload
                          : handleRetake
                      }
                      className="w-full rounded-xl bg-gray-800 px-3 py-2 text-xs font-black text-white transition hover:bg-gray-700 active:scale-[0.98] sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      {mode === 'upload'
                        ? 'Re-upload'
                        : 'Retake'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full rounded-xl bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:px-3 sm:py-2.5 sm:text-sm"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  {error && (
                    <p className="px-3 pb-3 text-center text-xs font-semibold text-red-300">
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UniversalImageEditor;
