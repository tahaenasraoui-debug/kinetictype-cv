import { useCallback, useEffect, useRef, useState } from 'react';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import type { HandLandmarkFrame, Point3D } from '../types';
import { HandRingBuffer } from '../utils/sensorFusion';

export type TrackerStatus = 'idle' | 'loading' | 'active' | 'fallback';

export function useHandTracker() {
    const [status, setStatus] = useState<TrackerStatus>('idle');
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [fps, setFps] = useState<number>(0);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const landmarkerRef = useRef<HandLandmarker | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const rafRef = useRef<number | null>(null);
    const ringBufferRef = useRef<HandRingBuffer>(new HandRingBuffer(180));
    const latestFrameRef = useRef<HandLandmarkFrame | null>(null);

    const stopCamera = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        setStatus('idle');
        setFps(0);
    }, []);

    const startCamera = useCallback(async () => {
        setStatus('loading');
        setErrorMsg(null);

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('Webcam API unavailable in this browser context.');
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    frameRate: { ideal: 60 },
                },
                audio: false,
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }

            if (!landmarkerRef.current) {
                const vision = await FilesetResolver.forVisionTasks(
                    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm'
                );
                landmarkerRef.current = await HandLandmarker.createFromOptions(vision, {
                    baseOptions: {
                        modelAssetPath:
                        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
                        delegate: 'GPU',
                    },
                    runningMode: 'VIDEO',
                    numHands: 2,
                    minHandDetectionConfidence: 0.55,
                    minHandPresenceConfidence: 0.55,
                    minTrackingConfidence: 0.55,
                });
            }

            setStatus('active');

            let lastVideoTime = -1;
            let frameCounter = 0;
            let lastFpsTs = performance.now();

            const detectLoop = () => {
                const video = videoRef.current;
                const detector = landmarkerRef.current;

                if (video && detector && video.readyState >= 2) {
                    const now = performance.now();
                    if (video.currentTime !== lastVideoTime) {
                        lastVideoTime = video.currentTime;
                        const res = detector.detectForVideo(video, now);

                        let leftLandmarks: Point3D[] | null = null;
                        let rightLandmarks: Point3D[] | null = null;

                        if (res.landmarks && res.handednesses) {
                            res.landmarks.forEach((lmList, idx) => {
                                const category = res.handednesses[idx]?.[0]?.categoryName;
                                const mapped: Point3D[] = lmList.map((p) => ({ x: p.x, y: p.y, z: p.z }));
                                if (category === 'Left') leftLandmarks = mapped;
                                else rightLandmarks = mapped;
                            });
                        }

                        const frame: HandLandmarkFrame = {
                            timestamp: now,
                            leftLandmarks,
                            rightLandmarks,
                        };
                        ringBufferRef.current.push(frame);
                        latestFrameRef.current = frame;

                        frameCounter++;
                        if (now - lastFpsTs >= 1000) {
                            setFps(Math.round((frameCounter * 1000) / (now - lastFpsTs)));
                            frameCounter = 0;
                            lastFpsTs = now;
                        }
                    }
                }
                rafRef.current = requestAnimationFrame(detectLoop);
            };

            rafRef.current = requestAnimationFrame(detectLoop);
        } catch (err) {
            const message =
            err instanceof Error ? err.message : 'Camera permission denied or no webcam found.';
            setErrorMsg(message);
            setStatus('fallback');
        }
    }, []);

    useEffect(() => {
        return () => {
            stopCamera();
        };
    }, [stopCamera]);

    return {
        status,
        errorMsg,
        fps,
        videoRef,
        ringBufferRef,
        latestFrameRef,
        startCamera,
        stopCamera,
    };
}
