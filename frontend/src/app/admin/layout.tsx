import AdminDesktopLayout from "./components/layout/AdminDesktopLayout";
import AdminMobileLayout from "./components/layout/AdminMobileLayout";
import { useDevice } from "../hooks/useDevice";

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { currentUser, theme } = useAppStore();
  const { isMobile } = useDevice();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && (!currentUser || currentUser.role !== "admin")) {
      router.push("/");
    }
  }, [currentUser, router, mounted]);

  if (!mounted || !currentUser) return null;

  if (isMobile) {
    return <AdminMobileLayout>{children}</AdminMobileLayout>;
  }

  return <AdminDesktopLayout>{children}</AdminDesktopLayout>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminProvider>
  );
}
