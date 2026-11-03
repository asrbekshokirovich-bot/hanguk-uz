import { useCameraSession } from '@/hooks/useCameraSession';
import { useUserRole } from '@/hooks/useUserRole';
import { CamerasView } from '@/components/crm/cameras/CamerasView';

/** CRM → Kameralar: ofisdagi kameralar (lokal variant, docs/kameralar.md). */
export default function CamerasContent() {
  const state = useCameraSession();
  const { isOwner } = useUserRole();
  return <CamerasView state={state} isOwner={isOwner} />;
}
