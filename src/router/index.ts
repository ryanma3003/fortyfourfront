import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import Errorpagesinfo from "../shared/layouts/errorpagesinfo.vue";
import Landingpage from "../shared/layouts/landingpage.vue";
import Maindashboard from "../shared/layouts/maindashboard.vue";
import Authlayout from "../shared/layouts/authlayout.vue";
import { useAuthStore } from "../stores/auth";


const routes: RouteRecordRaw[] = [

  {
    path: '/',
    component: Authlayout,
    children: [
      {
        path: '',
        name: 'Login',
        component: () => import("../components/auth/login.vue")
      }
    ]
  },

  {
    path: '/',
    component: Maindashboard,
    children:
      [
        //Dashboard
        //Dashboard
        {
          path: 'profile',
          name: "Profile",
          component: () => import("../components/pages/profile.vue"),
        },
        {
          path: 'profile-settings',
          name: "Profile Settings",
          component: () => import("../components/pages/profile-settings.vue"),
        },
        {
          path: 'stakeholders-profile-settings',
          name: "Stakeholders Profile Settings",
          component: () => import("../components/pages/stakeholders-profile-settings.vue"),
        },
        {
          path: 'pic-add',
          name: "Pic Add",
          component: () => import("../components/pages/pic-add.vue"),
        },
        // Admin Routes
        {
          path: '',
          component: () => import("../shared/layouts/simple-router-view.vue"),
          meta: { requiresAdmin: true },
          children: [
            {
              path: 'dashboard',
              name: 'Admin Dashboard',
              component: () => import("../views/admin/Dashboard.vue"),
            },
            {
              path: 'notif',
              name: "Notif",
              component: () => import("../components/dashboards/notif.vue"),
            },
            {
              path: 'users',
              name: "Users List",
              component: () => import("../components/dashboards/users-list.vue"),
            },
            {
              path: 'users-profile/:slug',
              name: 'Profile User',
              component: () => import("../components/dashboards/user-profile.vue"),
            },

            {
              path: 'roles',
              name: "Role List",
              component: () => import("../components/pages/role-list.vue"),
            },
            {
              path: 'stakeholders',
              name: 'Stakeholders',
              component: () => import("../components/dashboards/stakeholders.vue"),
            },
            {
              path: 'stakeholders/:slug',
              name: 'Profile Stakeholders',
              component: () => import("../components/dashboards/profile-stakeholders.vue"),
            },
            {
              path: 'csirt-list',
              name: 'Csirt List',
              component: () => import("../components/dashboards/csirt-list.vue"),
            },
            {
              path: 'csirt-admin',
              redirect: '/csirt-list',
            },
            // LMS Routes
            {
              path: 'lms/kelas',
              name: 'LMS Kelas',
              component: () => import("../components/lms/lms-kelas.vue"),
            },
            {
              path: 'lms/kelas/create',
              name: 'LMS Kelas Create',
              component: () => import("../components/lms/lms-kelas-form.vue"),
            },
            {
              path: 'lms/kelas/edit/:id',
              name: 'LMS Kelas Edit',
              component: () => import("../components/lms/lms-kelas-form.vue"),
            },
            {
              path: 'lms/kelas/view/:id',
              name: 'LMS Kelas Detail',
              component: () => import("../components/lms/lms-kelas-detail.vue"),
            },
            {
              path: 'lms/materi',
              name: 'LMS Materi',
              component: () => import("../components/lms/lms-materi.vue"),
            },
            {
              path: 'lms/materi/create',
              name: 'LMS Materi Create',
              component: () => import("../components/lms/lms-materi-form.vue"),
            },
            {
              path: 'lms/materi/edit/:id',
              name: 'LMS Materi Edit',
              component: () => import("../components/lms/lms-materi-form.vue"),
            },
            {
              path: 'lms/quiz',
              name: 'LMS Quiz',
              component: () => import("../components/lms/lms-quiz.vue"),
            },
            {
              path: 'lms/quiz/create',
              name: 'LMS Quiz Create',
              component: () => import("../components/lms/lms-quiz-form.vue"),
            },
            {
              path: 'lms/quiz/edit/:id',
              name: 'LMS Quiz Edit',
              component: () => import("../components/lms/lms-quiz-form.vue"),
            },
            // Event Routes
            {
              path: 'event',
              name: 'Event',
              component: () => import("../components/event/event-list.vue"),
            },
            {
              path: 'event/create',
              name: 'Event Create',
              component: () => import("../components/event/event-form.vue"),
            },
            {
              path: 'event/edit/:id',
              name: 'Event Edit',
              component: () => import("../components/event/event-form.vue"),
            },
            {
              path: 'kse-list-admin',
              name: 'Admin KSE List',
              component: () => import("../components/dashboards/kse-list-admin.vue"),
            },
          ]
        },
        {
          path: `ikas`,
          name: 'Ikas',
          meta: { requiresStakeholder: true },
          component: () => import("../components/ikas.vue"),
        },
        {
          path: `ikas-crud`,
          name: 'Ikas Crud',
          meta: { requiresStakeholder: true },
          component: () => import("../components/ikas-crud.vue"),
        },
        {
          path: `kse`,
          name: 'Kse',
          meta: { requiresStakeholder: true },
          component: () => import("../components/kse/KategorisasiSE-list.vue"),
        },
        {
          path: `kse-crud`,
          name: 'Kse Crud',
          meta: { requiresStakeholder: true },
          component: () => import("../components/kse-crud.vue"),
        },
        {
          path: `csirt/:id?`,
          name: 'Csirt',
          component: () => import("../components/dashboards/csirt.vue"),
        },
        {
          path: `profile-resiko`,
          name: 'Profile Resiko',
          meta: { requiresStakeholder: true },
          component: () => import("../components/pages/profile-resiko.vue"),
        },
        {
          path: `survey-resiko`,
          name: 'Survey Resiko',
          meta: { requiresStakeholder: true },
          component: () => import("../components/resiko-crud.vue"),
        },

        //children: [
        //   {
        //     path: 'sales',
        //     name: "Sales",

        //   },
        //   {
        //     path: 'analytics',
        //     name: "Analytics",
        //     component: () => import("../components/dashboards/analytics.vue"),
        //   },
        // {
        //   path: 'ecommerce',
        //   name: "Ecommerce",
        //   children: [
        //     {
        //       path: 'ecommerce-dashboard',
        //       name: 'Ecommerce Dashboard',
        //       component: () => import("../components/dashboards/ecommerce/dashboard.vue"),
        //     },
        //     {
        //       path: 'products',
        //       name: 'Products',
        //       component: () => import("../components/dashboards/ecommerce/products.vue"),
        //     },
        //     {
        //       path: 'product-details',
        //       name: 'Product Details',
        //       component: () => import("../components/dashboards/ecommerce/product-details.vue"),
        //     },
        //     {
        //       path: 'cart',
        //       name: 'Cart',
        //       component: () => import("../components/dashboards/ecommerce/cart.vue"),
        //     },
        //     {
        //       path: 'checkout',
        //       name: 'Checkout',
        //       component: () => import("../components/dashboards/ecommerce/checkout.vue"),
        //     },
        //     {
        //       path: 'customers',
        //       name: 'Customers',
        //       component: () => import("../components/dashboards/ecommerce/customers.vue"),
        //     },
        //     {
        //       path: 'orders',
        //       name: 'Orders',
        //       component: () => import("../components/dashboards/ecommerce/orders.vue"),
        //     },
        //     {
        //       path: 'order-details',
        //       name: 'Order Details',
        //       component: () => import("../components/dashboards/ecommerce/order-details.vue"),
        //     },
        //     {
        //       path: 'add-product',
        //       name: 'Add Product',
        //       component: () => import("../components/dashboards/ecommerce/add-product.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'crypto',
        //   name: "Crypto",
        //   children: [
        //     {
        //       path: 'crypto-dashboard',
        //       name: 'Crypto Dashboard',
        //       component: () => import("../components/dashboards/crypto/dashboard.vue"),
        //     },
        //     {
        //       path: 'transactions',
        //       name: 'Transactions',
        //       component: () => import("../components/dashboards/crypto/transactions.vue"),
        //     },
        //     {
        //       path: 'currency-exchange',
        //       name: 'Currency Exchange',
        //       component: () => import("../components/dashboards/crypto/currency-exchange.vue"),
        //     },
        //     {
        //       path: 'buy-sell',
        //       name: 'Buy $ Sell',
        //       component: () => import("../components/dashboards/crypto/buy-sell.vue"),
        //     },
        //     {
        //       path: 'market-cap',
        //       name: 'Marketcap',
        //       component: () => import("../components/dashboards/crypto/market-cap.vue"),
        //     },
        //     {
        //       path: 'wallet',
        //       name: 'Wallet',
        //       component: () => import("../components/dashboards/crypto/wallet.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'crm',
        //   name: "CRM",
        //   children: [
        //     {
        //       path: 'crm-dashboard',
        //       name: 'CRM Dashboard',
        //       component: () => import("../components/dashboards/crm/dashboard.vue"),
        //     },
        //     {
        //       path: 'contacts',
        //       name: 'Contacts',
        //       component: () => import("../components/dashboards/crm/contacts.vue"),
        //     },
        //     {
        //       path: 'companies',
        //       name: 'Companies',
        //       component: () => import("../components/dashboards/crm/companies.vue"),
        //     },
        //     {
        //       path: 'deals',
        //       name: 'Deals',
        //       component: () => import("../components/dashboards/crm/deals.vue"),
        //     },
        //     {
        //       path: 'leads',
        //       name: 'Leads',
        //       component: () => import("../components/dashboards/crm/leads.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'projects',
        //   name: "Projects",
        //   children: [
        //     {
        //       path: 'project-dashboard',
        //       name: 'Projects Dashboard',
        //       component: () => import("../components/dashboards/projects/dashboard.vue"),
        //     },
        //     {
        //       path: 'projects-list',
        //       name: 'Project List',
        //       component: () => import("../components/dashboards/projects/projects-list.vue"),
        //     },
        //     {
        //       path: 'project-overview',
        //       name: 'Project Overview',
        //       component: () => import("../components/dashboards/projects/project-overview.vue"),
        //     },
        //     {
        //       path: 'create-project',
        //       name: 'Create Project',
        //       component: () => import("../components/dashboards/projects/create-project.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'hrm',
        //   name: "HRM",
        //   component: () => import("../components/dashboards/hrm.vue"),
        // },
        // {
        //   path: 'courses',
        //   name: "Courses",
        //   component: () => import("../components/dashboards/courses.vue"),
        // },
        // {
        //   path: 'stocks',
        //   name: "Stocks",
        //   component: () => import("../components/dashboards/stocks.vue"),
        // },
        // {
        //   path: 'nft',
        //   name: "NFT",
        //   children: [
        //     {
        //       path: 'nft-dashboard',
        //       name: 'Nft Dashboard',
        //       component: () => import("../components/dashboards/nft/dashboard.vue"),
        //     },
        //     {
        //       path: 'market-place',
        //       name: 'Market Place',
        //       component: () => import("../components/dashboards/nft/market-place.vue"),
        //     },
        //     {
        //       path: 'nft-details',
        //       name: 'NFT Details',
        //       component: () => import("../components/dashboards/nft/nft-details.vue"),
        //     },
        //     {
        //       path: 'create-nft',
        //       name: 'Create NFT',
        //       component: () => import("../components/dashboards/nft/create-nft.vue"),
        //     },
        //     {
        //       path: 'wallet-integration',
        //       name: 'Wallet ntegration',
        //       component: () => import("../components/dashboards/nft/wallet-integration.vue"),
        //     },
        //     {
        //       path: 'live-auction',
        //       name: 'Live Auction',
        //       component: () => import("../components/dashboards/nft/live-auction.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'jobs',
        //   name: "Jobs",
        //   children: [
        //     {
        //       path: 'jobs-dashboard',
        //       name: 'Jobs Dashboard',
        //       component: () => import("../components/dashboards/jobs/dashboard.vue"),
        //     },
        //     {
        //       path: 'job-details',
        //       name: 'Job Details',
        //       component: () => import("../components/dashboards/jobs/job-details.vue"),
        //     },
        //     {
        //       path: 'search-company',
        //       name: 'Search Company',
        //       component: () => import("../components/dashboards/jobs/search-company.vue"),
        //     },
        //     {
        //       path: 'search-jobs',
        //       name: 'Search Jobs',
        //       component: () => import("../components/dashboards/jobs/search-jobs.vue"),
        //     },
        //     {
        //       path: 'job-post',
        //       name: 'Job Post',
        //       component: () => import("../components/dashboards/jobs/job-post.vue"),
        //     },
        //     {
        //       path: 'jobs-list',
        //       name: 'Jobs List',
        //       component: () => import("../components/dashboards/jobs/jobs-list.vue"),
        //     },
        //     {
        //       path: 'search-candidate',
        //       name: 'Search Candidate',
        //       component: () => import("../components/dashboards/jobs/search-candidate.vue"),
        //     },
        //     {
        //       path: 'candidate-details',
        //       name: 'Candidate Details',
        //       component: () => import("../components/dashboards/jobs/candidate-details.vue"),
        //     },
        //   ]
        // },
        // {
        //   path: 'social-media',
        //   name: "Social Media",
        //   component: () => import("../components/dashboards/social-media.vue"),
        // },
        // {
        //   path: 'pos-system',
        //   name: "POS System",
        //   component: () => import("../components/dashboards/pos-system.vue"),
        // },



        //applications
        {
          path: `applications`,
          name: 'Applications',
          children: [
            {
              path: 'email',
              name: "Email",
              children: [
                {
                  path: 'mail-app',
                  name: 'Mail App',
                  component: () => import("../components/applications/email/mail-app.vue"),
                },
                {
                  path: 'mail-settings',
                  name: 'Mail Settings',
                  component: () => import("../components/applications/email/mail-settings.vue"),
                }
              ]
            },
            {
              path: 'file-manager',
              name: "File Manager",
              component: () => import("../components/applications/file-manager.vue"),
            },
            {
              path: 'full-calendar',
              name: "Full Calendar",
              component: () => import("../components/applications/full-calendar.vue"),
            },
            {
              path: 'gallery',
              name: "Gallery",
              component: () => import("../components/applications/gallery.vue"),
            },
            {
              path: 'sweet-alerts',
              name: "Sweet Alerts",
              component: () => import("../components/applications/sweet-alerts.vue"),
            },
            {
              path: 'task',
              name: "Task",
              children: [
                {
                  path: 'kanban-board',
                  name: 'Kanban Board',
                  component: () => import("../components/applications/task/kanban-board.vue"),
                },
                {
                  path: 'list-view',
                  name: 'List View',
                  component: () => import("../components/applications/task/list-view.vue"),
                }
              ]
            },
            {
              path: 'to-do-list',
              name: "To Do List",
              component: () => import("../components/applications/to-do-list.vue"),
            },
          ],
        },



        //Pages
        {
          path: `pages`,
          name: 'Pages',
          children: [
            {
              path: "blog",
              name: "Blog",
              children: [
                {
                  path: "blog",
                  component: () =>
                    import("../components/pages/blog/blog.vue"),
                },
                {
                  path: "blog-details",
                  component: () =>
                    import("../components/pages/blog/blog-details.vue"),
                },
                {
                  path: "create-blog",
                  component: () =>
                    import("../components/pages/blog/create-blog.vue"),
                },
              ],
            },
            {
              path: 'empty',
              name: "Empty",
              component: () => import("../components/pages/empty.vue"),
            },
            // Forms
            {
              path: `forms`,
              name: 'Forms',
              children: [
                {
                  path: 'form-advanced',
                  name: "Form Advanced",
                  component: () => import("../components/pages/forms/form-advanced.vue"),
                },
                {
                  path: "form-elements",
                  name: "Form Elements",
                  children: [
                    {
                      path: "inputs",
                      component: () =>
                        import("../components/pages/forms/form-elements/inputs.vue"),
                    },
                    {
                      path: "checks-radios",
                      component: () =>
                        import("../components/pages/forms/form-elements/checks-radios.vue"),
                    },
                    {
                      path: "input-group",
                      component: () =>
                        import("../components/pages/forms/form-elements/input-group.vue"),
                    },
                    {
                      path: "form-select",
                      component: () =>
                        import("../components/pages/forms/form-elements/form-select.vue"),
                    },
                    {
                      path: "range-slider",
                      component: () =>
                        import("../components/pages/forms/form-elements/range-slider.vue"),
                    },
                    {
                      path: "input-masks",
                      component: () =>
                        import("../components/pages/forms/form-elements/input-masks.vue"),
                    },
                    {
                      path: "file-uploads",
                      component: () =>
                        import("../components/pages/forms/form-elements/file-uploads.vue"),
                    },
                    {
                      path: "date-time-picker",
                      component: () =>
                        import("../components/pages/forms/form-elements/date-time-picker.vue"),
                    },
                    {
                      path: "color-picker",
                      component: () =>
                        import("../components/pages/forms/form-elements/color-picker.vue"),
                    },
                  ],
                },
                {
                  path: 'floating-labels',
                  name: "Floating Labels",
                  component: () => import("../components/pages/forms/floating-labels.vue"),
                },
                {
                  path: 'form-layouts',
                  name: "Form Layouts",
                  component: () => import("../components/pages/forms/form-layouts.vue"),
                },
                {
                  path: 'form-wizards',
                  name: "Form Wizards",
                  component: () => import("../components/pages/forms/form-wizards.vue"),
                },

                {
                  path: 'vue-editor',
                  name: "Vue Editor",
                  component: () => import("../components/pages/forms/vue-editor.vue"),
                },

                {
                  path: 'validation',
                  name: "Validation",
                  component: () => import("../components/pages/forms/validation.vue"),
                },
                {
                  path: 'select2',
                  name: "Select2",
                  component: () => import("../components/pages/forms/select2.vue"),
                },
              ]
            },
            {
              path: 'faqs',
              name: "Faqs",
              component: () => import("../components/pages/faqs.vue"),
            },
            {
              path: 'invoice',
              name: "Invoice",
              children: [
                {
                  path: 'create-invoice',
                  name: 'Create Invoice',
                  component: () => import("../components/pages/invoice/create-invoice.vue"),
                },
                {
                  path: 'invoice-details',
                  name: 'Invoice Details',
                  component: () => import("../components/pages/invoice/invoice-details.vue"),
                },
                {
                  path: 'invoice-list',
                  name: 'Invoice List',
                  component: () => import("../components/pages/invoice/invoice-list.vue"),
                }
              ]
            },
            {
              path: 'pricing',
              name: "Pricing",
              component: () => import("../components/pages/pricing.vue"),
            },

            {
              path: 'testimonials',
              name: "Testimonials",
              component: () => import("../components/pages/testimonials.vue"),
            },
            {
              path: 'search',
              name: "Search",
              component: () => import("../components/pages/search.vue"),
            },
            {
              path: 'team',
              name: "Team",
              component: () => import("../components/pages/team.vue"),
            },
            {
              path: 'terms-conditions',
              name: "Terms Conditions",
              component: () => import("../components/pages/terms-conditions.vue"),
            },
            {
              path: 'timeline',
              name: "Timeline",
              component: () => import("../components/pages/timeline.vue"),
            },


          ]
        },

        {
          path: 'general',
          name: "General",
          children: [
            //Ui Elements
            {
              path: `ui-elements`,
              name: 'Ui Elements',
              children: [
                {
                  path: 'alerts',
                  name: "Alerts",
                  component: () => import("../components/general/ui-elements/alerts.vue"),
                },
                {
                  path: 'badge',
                  name: "Badges",
                  component: () => import("../components/general/ui-elements/badge.vue"),
                },
                {
                  path: 'breadcrumb',
                  name: "Breadcrumb",
                  component: () => import("../components/general/ui-elements/breadcrumb.vue"),
                },
                {
                  path: 'buttons',
                  name: "Buttons",
                  component: () => import("../components/general/ui-elements/buttons.vue"),
                },
                {
                  path: 'button-group',
                  name: "Button Group",
                  component: () => import("../components/general/ui-elements/button-group.vue"),
                },
                {
                  path: 'cards',
                  name: "Cards",
                  component: () => import("../components/general/ui-elements/cards.vue"),
                },
                {
                  path: 'dropdowns',
                  name: "Dropdowns",
                  component: () => import("../components/general/ui-elements/dropdowns.vue"),
                },
                {
                  path: 'images-figures',
                  name: "Images & Figures",
                  component: () => import("../components/general/ui-elements/images-figures.vue"),
                },
                {
                  path: 'links-interactions',
                  name: "Links & Interactions",
                  component: () => import("../components/general/ui-elements/links-interactions.vue"),
                },
                {
                  path: 'list-group',
                  name: "List Group",
                  component: () => import("../components/general/ui-elements/list-group.vue"),
                },
                {
                  path: 'navs-tabs',
                  name: "Navs Tabs",
                  component: () => import("../components/general/ui-elements/navs-tabs.vue"),
                },
                {
                  path: 'object-fit',
                  name: "Object Fit",
                  component: () => import("../components/general/ui-elements/object-fit.vue"),
                },
                {
                  path: 'pagination',
                  name: "Pagination",
                  component: () => import("../components/general/ui-elements/pagination.vue"),
                },
                {
                  path: 'popovers',
                  name: "Popovers",
                  component: () => import("../components/general/ui-elements/popovers.vue"),
                },
                {
                  path: 'progress',
                  name: "Progress",
                  component: () => import("../components/general/ui-elements/progress.vue"),
                },
                {
                  path: 'spinners',
                  name: "Spinners",
                  component: () => import("../components/general/ui-elements/spinners.vue"),
                },
                {
                  path: 'toasts',
                  name: "Toasts",
                  component: () => import("../components/general/ui-elements/toasts.vue"),
                },
                {
                  path: 'tooltips',
                  name: "Tooltips",
                  component: () => import("../components/general/ui-elements/tooltips.vue"),
                },
                {
                  path: 'typography',
                  name: "Typography",
                  component: () => import("../components/general/ui-elements/typography.vue"),
                },
              ]
            },
            //Utilities
            {
              path: `utilities`,
              name: 'Utilities',
              children: [
                {
                  path: 'avatars',
                  name: "Avatars",
                  component: () => import("../components/general/utilities/avatars.vue"),
                },
                {
                  path: 'borders',
                  name: "Borders",
                  component: () => import("../components/general/utilities/borders.vue"),
                },
                {
                  path: 'breakpoints',
                  name: "Breakpoints",
                  component: () => import("../components/general/utilities/breakpoints.vue"),
                },
                {
                  path: 'colors',
                  name: "Colors",
                  component: () => import("../components/general/utilities/colors.vue"),
                },
                {
                  path: 'columns',
                  name: "Columns",
                  component: () => import("../components/general/utilities/columns.vue"),
                },
                {
                  path: 'css-grid',
                  name: "Css Grid",
                  component: () => import("../components/general/utilities/css-grid.vue"),
                },
                {
                  path: 'flex',
                  name: "Flex",
                  component: () => import("../components/general/utilities/flex.vue"),
                },
                {
                  path: 'gutters',
                  name: "Gutter",
                  component: () => import("../components/general/utilities/gutters.vue"),
                },
                {
                  path: 'helpers',
                  name: "Helpers",
                  component: () => import("../components/general/utilities/helpers.vue"),
                },
                {
                  path: 'position',
                  name: "Position",
                  component: () => import("../components/general/utilities/position.vue"),
                },
                {
                  path: 'additional-content',
                  name: "Additional Content",
                  component: () => import("../components/general/utilities/additional-content.vue"),
                },
              ]
            },

            // Advance Ui
            {
              path: `advanced-ui`,
              name: 'Advanced Ui',
              children: [
                {
                  path: 'accordions-collapse',
                  name: "Accordion Collapse",
                  component: () => import("../components/general/advanced-ui/accordions-collapse.vue"),
                },
                {
                  path: 'carousel',
                  name: "Carousel",
                  component: () => import("../components/general/advanced-ui/carousel.vue"),
                },
                {
                  path: 'draggable-cards',
                  name: "Draggable Cards",
                  component: () => import("../components/general/advanced-ui/draggable-cards.vue"),
                },
                {
                  path: 'media-player',
                  name: "Media Player",
                  component: () => import("../components/general/advanced-ui/media-player.vue"),
                },
                {
                  path: 'modals-closes',
                  name: "Modals Closes",
                  component: () => import("../components/general/advanced-ui/modals-closes.vue"),
                },
                {
                  path: 'navbar',
                  name: "Navbar",
                  component: () => import("../components/general/advanced-ui/navbar.vue"),
                },
                {
                  path: 'offcanvas',
                  name: "Offcanvas",
                  component: () => import("../components/general/advanced-ui/offcanvas.vue"),
                },
                {
                  path: 'placeholders',
                  name: "Placeholders",
                  component: () => import("../components/general/advanced-ui/placeholders.vue"),
                },
                {
                  path: 'ratings',
                  name: "Ratings",
                  component: () => import("../components/general/advanced-ui/ratings.vue"),
                },
                {
                  path: 'ribbons',
                  name: "Ribbons",
                  component: () => import("../components/general/advanced-ui/ribbons.vue"),
                },
                {
                  path: 'sortable-js',
                  name: "SortableJs",
                  component: () => import("../components/general/advanced-ui/sortable-js.vue"),
                },
                {
                  path: 'swiper-js',
                  name: "Swiper-js",
                  component: () => import("../components/general/advanced-ui/swiper-js.vue"),
                },
                {
                  path: 'tour',
                  name: "Tour",
                  component: () => import("../components/general/advanced-ui/tour.vue"),
                },
              ]
            },
          ]
        },

        // widgets
        // {
        //   path: 'widgets',
        //   name: 'Widgets',
        //   component: () => import("../components/widgets.vue"),
        // },

        //maps
        // {
        //   path: `maps`,
        //   name: 'Maps',
        //   children: [
        //     {
        //       path: 'google',
        //       name: "Google",
        //       component: () => import("../components/maps/google.vue"),
        //     },
        //     {
        //       path: 'leaflet',
        //       name: "Leaflet",
        //       component: () => import("../components/maps/leaflet.vue"),
        //     },
        //     {
        //       path: 'jsvector',
        //       name: "Jsvector",
        //       component: () => import("../components/maps/jsvector.vue"),
        //     },
        //   ]
        // },



        // //icons
        // {
        //   path: 'icons',
        //   name: 'Icons',
        //   component: () => import("../components/icons.vue"),
        // },

        //charts
        {
          path: `charts`,
          name: 'Charts',
          children: [
            {
              path: "apex-charts",
              name: "Apex Charts",
              children: [
                {
                  path: "line-chart",
                  component: () =>
                    import("../components/charts/apex-charts/line-chart.vue"),
                },
                {
                  path: "area-chart",
                  component: () =>
                    import("../components/charts/apex-charts/area-chart.vue"),
                },
                {
                  path: "column-chart",
                  component: () =>
                    import("../components/charts/apex-charts/column-chart.vue"),
                },
                {
                  path: "bar-chart",
                  component: () =>
                    import("../components/charts/apex-charts/bar-chart.vue"),
                },
                {
                  path: "mixed-chart",
                  component: () =>
                    import("../components/charts/apex-charts/mixed-chart.vue"),
                },
                {
                  path: "funnel-chart",
                  component: () =>
                    import("../components/charts/apex-charts/funnel-chart.vue"),
                },
                {
                  path: "candlestick-chart",
                  component: () =>
                    import("../components/charts/apex-charts/candlestick-chart.vue"),
                },
                {
                  path: "boxplot-chart",
                  component: () =>
                    import("../components/charts/apex-charts/boxplot-chart.vue"),
                },
                {
                  path: "bubble-chart",
                  component: () =>
                    import("../components/charts/apex-charts/bubble-chart.vue"),
                },
                {
                  path: "scatter-chart",
                  component: () =>
                    import("../components/charts/apex-charts/scatter-chart.vue"),
                },
                {
                  path: "heatmap-chart",
                  component: () =>
                    import("../components/charts/apex-charts/heatmap-chart.vue"),
                },
                {
                  path: "treemap-chart",
                  component: () =>
                    import("../components/charts/apex-charts/treemap-chart.vue"),
                },
                {
                  path: "pie-chart",
                  component: () =>
                    import("../components/charts/apex-charts/pie-chart.vue"),
                },
                {
                  path: "radialbar-chart",
                  component: () =>
                    import("../components/charts/apex-charts/radialbar-chart.vue"),
                },
                {
                  path: "radar-chart",
                  component: () =>
                    import("../components/charts/apex-charts/radar-chart.vue"),
                },
                {
                  path: "polararea-chart",
                  component: () =>
                    import("../components/charts/apex-charts/polararea-chart.vue"),
                },
              ]
            },
            {
              path: 'chartjs-charts',
              name: "ChartJs",
              component: () => import("../components/charts/chartjs-charts.vue"),
            },
            {
              path: 'echart-charts',
              name: "Echarts",
              component: () => import("../components/charts/echart-charts.vue"),
            },
          ]
        },

        //tables
        {
          path: `tables`,
          name: 'Tables',
          children: [
            {
              path: 'tables',
              name: "Table",
              component: () => import("../components/tables/tables.vue"),
            },
            {
              path: 'gridjs',
              name: "Gridjs",
              component: () => import("../components/tables/girdjs.vue"),
            },
            {
              path: 'data-tables',
              name: "Data-Tables",
              component: () => import("../components/tables/data-tables.vue"),
            },
          ]
        },


      ],
  },

  {
    path: `/pages`,
    component: Landingpage,
    children: [
      {
        path: "landing",
        name: "landingpage",
        component: () => import("../components/pages/landing.vue"),
      },
    ],
  },
  // Authentication
  {
    path: `/pages/authentication`,
    component: Errorpagesinfo,
    children: [
      {
        path: "coming-soon",
        component: () => import("../components/pages/authentication/coming-soon.vue"),
      },
      {
        path: "create-password",
        name: "Create Password",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/create-password/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/create-password/cover.vue"),
          },
        ]
      },
      {
        path: "lock-screen",
        name: "Lock Screen",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/lock-screen/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/lock-screen/cover.vue"),
          },
        ]
      },
      {
        path: "reset-password",
        name: "Reset Password",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/reset-password/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/reset-password/cover.vue"),
          },
        ]
      },
      {
        path: "sign-up",
        name: "Sign Up",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/sign-up/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/sign-up/cover.vue"),
          },
        ]
      },
      {
        path: "sign-in",
        name: "Sign in",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/sign-in/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/sign-in/cover.vue"),
          },
        ]
      },
      {
        path: "two-step-verification",
        name: "Two Step Verification",
        children: [
          {
            path: "basic",
            component: () =>
              import("../components/pages/authentication/two-step-verification/basic.vue"),
          },
          {
            path: "cover",
            component: () =>
              import("../components/pages/authentication/two-step-verification/cover.vue"),
          },
        ]
      },
      {
        path: "under-maintenance",
        component: () => import("../components/pages/authentication/under-maintainance.vue"),
      },
    ],
  },

  // earrorpage
  {
    path: `/pages/error`,
    component: Errorpagesinfo,
    children: [
      {
        path: "401-error",
        component: () => import("../components/pages/error/401-error.vue"),
      },
      {
        path: "404-error",
        component: () => import("../components/pages/error/404-error.vue"),
      },
      {
        path: "500-error",
        component: () => import("../components/pages/error/500-error.vue"),
      },
    ]
  }
];


const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

// Navigation guard for authentication
router.beforeEach(async (to, _from, next) => {
  const authStore = useAuthStore();

  const isAuthenticated = authStore.authenticated;

  // Public routes that don't require authentication
  const isPublicRoute =
    to.path === '/' ||
    to.path.startsWith('/pages/authentication') ||
    to.path.startsWith('/pages/error');

  // Special handling for MFA two-step-verification page
  const isMfaPage = to.path === '/pages/authentication/two-step-verification/basic';

  if (isMfaPage) {
    const queryMode = to.query.mode as string;
    if (queryMode === 'setup' && !authStore.setupToken) {
      // No setup token — cannot access setup page
      next('/');
    } else if (queryMode === 'verify' && !authStore.mfaToken) {
      // No mfa token — cannot access verify page
      next('/');
    } else if (!queryMode) {
      // No mode specified — redirect to login
      next('/');
    } else {
      next();
    }
  } else if (!isAuthenticated && !isPublicRoute) {
    // Redirect to login if not authenticated
    next('/');
  } else if (isAuthenticated && to.path === '/') {
    // Redirect to admin dashboard if already authenticated
    next('/dashboard');
  } else if (to.meta?.requiresAdmin) {
    // Check admin/staff role for admin routes
    if (!authStore.isAdmin) {
      // Non-admin/staff users cannot access admin routes — log out
      await authStore.logUserOut();
      next('/');
    } else if (authStore.isStaff && (to.path === '/users' || to.path === '/roles' || to.path.startsWith('/users-profile'))) {
      // Staff cannot access user management or role management
      next('/dashboard');
    } else {
      next();
    }
  } else if (to.meta?.requiresStakeholder) {
    // Check if accessing IKAS/KSE without a valid stakeholder context (only for admins)
    if (authStore.isAdmin) {
      // Admin: strictly require slug in query params, no sessionStorage fallback
      const stakeholderSlug = to.query.stakeholder || to.query.slug;
      if (!stakeholderSlug) {
        next('/stakeholders');
      } else {
        sessionStorage.setItem('currentStakeholder', String(stakeholderSlug));
        next();
      }
    } else {
      // Non-admin users should not have access
      next('/dashboard');
    }
  } else {
    next();
  }
});

export default router;

