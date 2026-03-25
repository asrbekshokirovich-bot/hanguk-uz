declare namespace kakao.maps {
  class Map {
    constructor(container: HTMLElement, options: { center: LatLng; level: number });
    setCenter(latlng: LatLng): void;
    setLevel(level: number): void;
    getLevel(): number;
    panTo(latlng: LatLng): void;
    addControl(control: any, position: any): void;
    relayout(): void;
  }

  class LatLng {
    constructor(lat: number, lng: number);
    getLat(): number;
    getLng(): number;
  }

  class Marker {
    constructor(options: { position: LatLng; map?: Map; image?: MarkerImage });
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
    getPosition(): LatLng;
  }

  class MarkerImage {
    constructor(src: string, size: Size, options?: { offset?: Point });
  }

  class Size {
    constructor(width: number, height: number);
  }

  class Point {
    constructor(x: number, y: number);
  }

  class InfoWindow {
    constructor(options: { content: string; removable?: boolean; zIndex?: number });
    open(map: Map, marker: Marker): void;
    close(): void;
  }

  class CustomOverlay {
    constructor(options: { position: LatLng; content: string | HTMLElement; map?: Map; yAnchor?: number; zIndex?: number });
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
  }

  class Roadview {
    constructor(container: HTMLElement, options?: { panoId?: number; panoX?: number; panoY?: number });
    setPanoId(panoId: number, position: LatLng): void;
    relayout(): void;
  }

  class RoadviewClient {
    getNearestPanoId(position: LatLng, radius: number, callback: (panoId: number | null) => void): void;
  }

  class Circle {
    constructor(options: { center: LatLng; radius: number; strokeWeight?: number; strokeColor?: string; strokeOpacity?: number; fillColor?: string; fillOpacity?: number; map?: Map });
    setMap(map: Map | null): void;
    setPosition(position: LatLng): void;
  }

  namespace event {
    function addListener(target: any, type: string, handler: (...args: any[]) => void): void;
    function removeListener(target: any, type: string, handler: (...args: any[]) => void): void;
  }

  const ControlPosition: {
    TOP: number;
    TOPLEFT: number;
    TOPRIGHT: number;
    BOTTOM: number;
    BOTTOMLEFT: number;
    BOTTOMRIGHT: number;
    LEFT: number;
    RIGHT: number;
  };

  class ZoomControl {}
  class MapTypeControl {}

  function load(callback: () => void): void;
}

interface Window {
  kakao: typeof kakao;
}
