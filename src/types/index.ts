export type Category = 'Inventory' | 'Linen' | 'Amenity' | 'LostItem' | 'Waste' | 'General';
export interface OperationLink { id: string; title: string; description: string; category: Category; url: string; lastUpdated: string; buttonText: string; }
export interface FutureTask { id: string; title: string; issue: string; hypothesis: string; plan: string; owner: string; dueDate: string; status: 'Idea' | 'In Progress' | 'Completed' | 'Archived'; }
export interface RecentUpdate { id: string; date: string; title: string; type: 'Update' | 'Notice' | 'Experiment'; }
