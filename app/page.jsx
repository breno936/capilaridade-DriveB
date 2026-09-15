import DashboardClient from '../components/dashboard-client';
import initialCityCache from '../data/city-cache.json';
import initialWorkshopCategories from '../data/workshop-categories.json';

export default function HomePage() {
  return <DashboardClient initialCityCache={initialCityCache} initialWorkshopCategories={initialWorkshopCategories} />;
}
