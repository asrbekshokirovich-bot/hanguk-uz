import { useEffect, useRef } from 'react';
import { definePlayer, PLAYER_TAG, type HangukVideo, type PlayerState } from './hangukVideo';

interface LivePlayerProps {
  /** wss://…/api/ws?src=…&q=…&t=… — kalit yangilansa ham ochiq video uzilmaydi. */
  url: string;
  className?: string;
  onState?: (state: PlayerState) => void;
}

/** Jonli video. Komponent turguncha bitta pleyer; olib tashlanganda ulanish darrov yopiladi. */
export function LivePlayer({ url, className, onState }: LivePlayerProps) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<HangukVideo | null>(null);
  const urlRef = useRef(url);
  urlRef.current = url;
  const onStateRef = useRef(onState);
  onStateRef.current = onState;

  useEffect(() => {
    definePlayer();
    const el = document.createElement(PLAYER_TAG) as HangukVideo;
    el.style.display = 'block';
    el.style.width = '100%';
    el.style.height = '100%';
    const handler = (e: Event) => onStateRef.current?.((e as CustomEvent<PlayerState>).detail);
    el.addEventListener('player-state', handler);
    el.src = urlRef.current;
    onStateRef.current?.('connecting');
    host.current?.appendChild(el);
    player.current = el;
    return () => {
      el.removeEventListener('player-state', handler);
      el.remove();
      el.stop();
      player.current = null;
    };
  }, []);

  useEffect(() => {
    if (player.current) player.current.src = url;
  }, [url]);

  return <div ref={host} className={className} />;
}
