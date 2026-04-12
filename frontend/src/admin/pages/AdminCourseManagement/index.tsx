import { useState } from 'react';
import TopBar from '../../../components/TopBar';
import { Btn } from '../../../components/ui';
import AuditTab from './tabs/AuditTab';
import BlocksTab from './tabs/BlocksTab';
// Lazy load or import sub-tabs (We will build these next)
import CatalogTab from './tabs/CatalogTab';
import CurriculumTab from './tabs/CurriculumTab';
import FacilitiesTab from './tabs/FacilitiesTab';
import MappingsTab from './tabs/MappingsTab';
import OfferingsTab from './tabs/OfferingsTab';

/**
 * AdminCourseManagement
 *
 * The root module container for course administration.
 * Delegates data fetching and rendering to isolated tab components.
 */
export default function AdminCourseManagement() {
    const [mainTab, setMainTab] = useState<"catalog" | "curriculum" | "mappings" | "offerings" | "blocks" | "facilities" | "audit">("catalog");
    
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div className="no-print">
        <TopBar subtitle="Unified Catalog, Offerings, Mappings, and Curriculum" title="Course Management" />

        <div style={{ background: "#0f172a", borderBottom: "1px solid #334155", display: "flex", gap: "8px", padding: "10px 16px" }}>
            <Btn onClick={() => setMainTab("catalog")} variant={mainTab === "catalog" ? "primary" : "ghost"}>
            📚 Catalog
            </Btn>
            <Btn onClick={() => setMainTab("offerings")} variant={mainTab === "offerings" ? "primary" : "ghost"}>
            📅 Offerings
            </Btn>
            <Btn onClick={() => setMainTab("mappings")} variant={mainTab === "mappings" ? "primary" : "ghost"}>
            🔗 Program Mappings
            </Btn>
            <Btn onClick={() => setMainTab("curriculum")} variant={mainTab === "curriculum" ? "primary" : "ghost"}>
            📜 Curriculum
            </Btn>
            <Btn onClick={() => setMainTab("blocks")} variant={mainTab === "blocks" ? "primary" : "ghost"}>
            🏢 Blocks
            </Btn>
            <Btn onClick={() => setMainTab("facilities")} variant={mainTab === "facilities" ? "primary" : "ghost"}>
            🏢 Facilities
            </Btn>
            <Btn onClick={() => setMainTab("audit")} variant={mainTab === "audit" ? "primary" : "ghost"}>
            🔍 Audit
            </Btn>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {mainTab === "catalog" && <CatalogTab />}
        {mainTab === "offerings" && <OfferingsTab />}
        {mainTab === "mappings" && <MappingsTab />}
        {mainTab === "curriculum" && <CurriculumTab />}
        {mainTab === "blocks" && <BlocksTab />}
        {mainTab === "facilities" && <FacilitiesTab />}
        {mainTab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

