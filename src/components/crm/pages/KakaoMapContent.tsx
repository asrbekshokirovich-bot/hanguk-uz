import { useSearchParams } from 'react-router-dom';
import { KakaoMap } from '@/components/map/KakaoMap';

export default function KakaoMapContent() {
  const [searchParams] = useSearchParams();
  const focusUniversityId = searchParams.get('universityId');

  return (
    <div className="w-full h-[calc(100dvh-140px)] rounded-lg overflow-hidden border">
      <KakaoMap focusUniversityId={focusUniversityId} />
    </div>
  );
}
