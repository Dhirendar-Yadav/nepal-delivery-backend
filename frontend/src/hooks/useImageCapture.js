import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_ACCEPTED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp'
];

const DEFAULT_MAX_FILE_SIZE = 5 * 1024 * 1024;

const getCameraErrorMessage = (error, action = 'open') => {
  if (error?.name === 'NotAllowedError') {
    return 'Camera access was denied. Allow camera permission for this site in your browser settings, then try again.';
  }

  if (error?.name === 'NotFoundError') {
    return 'No camera was found on this device.';
  }

  if (error?.name === 'NotReadableError') {
    return 'Camera is currently unavailable or being used by another application.';
  }

  if (error?.name === 'SecurityError') {
    return 'Camera access is blocked by the browser security policy.';
  }

  if (action === 'switch') {
    return 'Unable to switch camera. Please try again.';
  }

  return 'Camera is unavailable. Check that your camera is connected and try again.';
};

const waitForImageLoad = (image) =>
  new Promise((resolve, reject) => {
    image.onload = resolve;
    image.onerror = () => {
      reject(new Error('Unable to read the selected image.'));
    };
  });

export default function useImageCapture({
  acceptedTypes = DEFAULT_ACCEPTED_TYPES,
  maxFileSize = DEFAULT_MAX_FILE_SIZE,
  initialFacingMode = 'user'
} = {}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const mountedRef = useRef(true);

  const [facingMode, setFacingMode] = useState(initialFacingMode);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const stopCamera = useCallback(() => {
    setCameraOpen(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    if (streamRef.current) {
      streamRef.current
        .getTracks()
        .forEach((track) => track.stop());

      streamRef.current = null;
    }
  }, []);

  const resetImageState = useCallback(() => {
    setCapturedImage(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCameraError('');
  }, []);

  const reset = useCallback(() => {
    stopCamera();
    resetImageState();
  }, [resetImageState, stopCamera]);

  const openCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access is not supported by this browser.'
      );
      return false;
    }

    setCameraError('');

    try {
      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode
          },
          audio: false
        });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      streamRef.current = stream;
      setCameraOpen(true);

      return true;
    } catch (error) {
      console.error(
        'Camera open failed:',
        error
      );

      if (mountedRef.current) {
        setCameraError(
          getCameraErrorMessage(error)
        );
      }

      return false;
    }
  }, [facingMode]);

  useEffect(() => {
    if (
      !cameraOpen ||
      !streamRef.current ||
      !videoRef.current
    ) {
      return;
    }

    const video = videoRef.current;
    const stream = streamRef.current;

    video.srcObject = stream;

    video.play().catch((error) => {
      console.error(
        'Camera preview failed:',
        error
      );

      if (mountedRef.current) {
        setCameraError(
          'Unable to start the camera preview. Please try again.'
        );
      }
    });

    return () => {
      if (video.srcObject === stream) {
        video.srcObject = null;
      }
    };
  }, [cameraOpen]);

  const switchCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access is not supported by this browser.'
      );
      return false;
    }

    const nextFacingMode =
      facingMode === 'user'
        ? 'environment'
        : 'user';

    setCameraError('');

    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              exact: nextFacingMode
            }
          },
          audio: false
        });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }

      const previousStream = streamRef.current;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        try {
          await videoRef.current.play();
        } catch (error) {
          stream.getTracks().forEach((track) => track.stop());

          console.error(
            'Camera switch preview failed:',
            error
          );

          if (mountedRef.current) {
            setCameraError(
              'Unable to start the switched camera preview. Please try again.'
            );
          }

          return false;
        }
      }

      streamRef.current = stream;
      setFacingMode(nextFacingMode);
      setCameraOpen(true);
      setCameraError('');

      if (previousStream) {
        previousStream
          .getTracks()
          .forEach((track) => track.stop());
      }

      return true;
    } catch (error) {
      console.error(
        'Camera switch failed:',
        error
      );

      if (
        mountedRef.current &&
        nextFacingMode === 'environment' &&
        (
          error?.name === 'OverconstrainedError' ||
          error?.name === 'NotFoundError'
        )
      ) {
        if (streamRef.current) {
          streamRef.current
            .getTracks()
            .forEach((track) => track.stop());

          streamRef.current = null;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        setCameraOpen(false);
        setFacingMode(nextFacingMode);
        setCameraError('');

        return true;
      }

      if (mountedRef.current) {
        setCameraError(
          getCameraErrorMessage(error, 'switch')
        );
      }

      return false;
    }
  }, [facingMode]);

  const capturePhoto = useCallback(() => {
    if (
      !videoRef.current ||
      !streamRef.current
    ) {
      setCameraError(
        'Camera is not ready. Please try again.'
      );
      return null;
    }

    const video = videoRef.current;

    if (
      !video.videoWidth ||
      !video.videoHeight
    ) {
      setCameraError(
        'Camera preview is not ready yet. Please try again.'
      );
      return null;
    }

    const size = Math.min(
      video.videoWidth,
      video.videoHeight
    );

    const canvas = document.createElement('canvas');

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');

    if (!context) {
      setCameraError(
        'Unable to capture the camera image. Please try again.'
      );
      return null;
    }

    const sourceX =
      (video.videoWidth - size) / 2;

    const sourceY =
      (video.videoHeight - size) / 2;

    context.drawImage(
      video,
      sourceX,
      sourceY,
      size,
      size,
      0,
      0,
      size,
      size
    );

    const imageData =
      canvas.toDataURL(
        'image/jpeg',
        0.92
      );

    setCapturedImage(imageData);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    stopCamera();

    return imageData;
  }, [stopCamera]);

  const selectImage = useCallback(() => {
    return new Promise((resolve) => {
      const input =
        document.createElement('input');

      input.type = 'file';
      input.accept =
        acceptedTypes.join(',');

      input.onchange = async () => {
        const file = input.files?.[0];

        if (!file) {
          resolve(null);
          return;
        }

        if (!acceptedTypes.includes(file.type)) {
          const error = new Error(
            `Only ${acceptedTypes
              .map((type) =>
                type
                  .split('/')[1]
                  .toUpperCase()
              )
              .join(', ')} images are allowed.`
          );

          if (mountedRef.current) {
            setCameraError(error.message);
          }

          resolve(null);
          return;
        }

        if (file.size > maxFileSize) {
          const error = new Error(
            `Image must be ${Math.round(
              maxFileSize / (1024 * 1024)
            )} MB or smaller.`
          );

          if (mountedRef.current) {
            setCameraError(error.message);
          }

          resolve(null);
          return;
        }

        try {
          const reader =
            new FileReader();

          const imageData =
            await new Promise(
              (resolveReader, rejectReader) => {
                reader.onload = () =>
                  resolveReader(
                    reader.result
                  );

                reader.onerror = () =>
                  rejectReader(
                    new Error(
                      'Unable to read the selected image.'
                    )
                  );

                reader.readAsDataURL(file);
              }
            );

          if (
            typeof imageData !== 'string'
          ) {
            throw new Error(
              'Unable to read the selected image.'
            );
          }

          if (mountedRef.current) {
            setCameraError('');
            setCapturedImage(imageData);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setCroppedAreaPixels(null);
            stopCamera();
          }

          resolve({
            file,
            imageData
          });
        } catch (error) {
          console.error(
            'Image selection failed:',
            error
          );

          if (mountedRef.current) {
            setCameraError(
              error.message ||
                'Unable to open the selected image. Please try again.'
            );
          }

          resolve(null);
        }
      };

      input.click();
    });
  }, [
    acceptedTypes,
    maxFileSize,
    stopCamera
  ]);

  const createCroppedBlob = useCallback(
    async (
      imageSrc = capturedImage,
      cropArea = croppedAreaPixels,
      outputType = 'image/jpeg',
      quality = 0.92
    ) => {
      if (!imageSrc || !cropArea) {
        throw new Error(
          'Image and crop area are required.'
        );
      }

      const allowedOutputTypes = new Set([
        'image/jpeg',
        'image/png',
        'image/webp'
      ]);

      if (!allowedOutputTypes.has(outputType)) {
        throw new Error(
          'Unsupported image output type.'
        );
      }

      const cropValues = [
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height
      ];

      if (
        cropValues.some(
          (value) =>
            !Number.isFinite(value)
        ) ||
        cropArea.width <= 0 ||
        cropArea.height <= 0
      ) {
        throw new Error(
          'Invalid crop area.'
        );
      }

      if (
        !Number.isFinite(quality) ||
        quality < 0 ||
        quality > 1
      ) {
        throw new Error(
          'Invalid image quality.'
        );
      }

      const image = new Image();

      image.src = imageSrc;

      await waitForImageLoad(image);

      const canvas =
        document.createElement('canvas');

      const context =
        canvas.getContext('2d');

      if (!context) {
        throw new Error(
          'Unable to create image canvas.'
        );
      }

      canvas.width = Math.floor(
        cropArea.width
      );

      canvas.height = Math.floor(
        cropArea.height
      );

      if (
        canvas.width <= 0 ||
        canvas.height <= 0
      ) {
        throw new Error(
          'Invalid cropped image dimensions.'
        );
      }

      context.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        canvas.width,
        canvas.height
      );

      return new Promise(
        (resolve, reject) => {
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(
                  new Error(
                    'Unable to generate cropped image.'
                  )
                );
                return;
              }

              resolve(blob);
            },
            outputType,
            quality
          );
        }
      );
    },
    [
      capturedImage,
      croppedAreaPixels
    ]
  );

  useEffect(() => {
    mountedRef.current = true;

    const videoElement = videoRef.current;

    return () => {
      mountedRef.current = false;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }

      if (videoElement) {
        videoElement.srcObject = null;
      }
    };
  }, []);

  return {
    videoRef,
    streamRef,

    facingMode,
    cameraOpen,
    cameraError,

    capturedImage,
    crop,
    zoom,
    croppedAreaPixels,

    setCapturedImage,
    setCrop,
    setZoom,
    setCroppedAreaPixels,

    openCamera,
    switchCamera,
    capturePhoto,
    selectImage,
    createCroppedBlob,

    stopCamera,
    resetImageState,
    reset
  };
}