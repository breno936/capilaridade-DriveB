import DashboardClient from '../components/dashboard-client';
import initialCityCache from '../data/city-cache.json';
import initialWorkshopCategories from '../data/workshop-categories.json';
import initialHeavyFleet from '../data/workshop-heavy-fleet.json';
import initialConcessionariaBrands from '../data/workshop-concessionaria-brands.json';
import initialNetworkConsultants from '../data/workshop-network-consultants.json';

export default function HomePage() {
  return (
    <DashboardClient
      initialCityCache={initialCityCache}
      initialWorkshopCategories={initialWorkshopCategories}
      initialHeavyFleet={initialHeavyFleet}
      initialConcessionariaBrands={initialConcessionariaBrands}
      initialNetworkConsultants={initialNetworkConsultants}
    />
  );
}
