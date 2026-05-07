//
//  ContentView.swift
//  Breadcrumbs
//
//  Created by MANNA on 5/3/26.
//

import SwiftUI

struct ContentView: View {
    var body: some View {
        VStack(spacing: 0) {
            BreadcrumbsWebView(url: AppConfiguration.webAppRootURL)
                .ignoresSafeArea(edges: [.top, .horizontal])

            Text("Ron Carpenter AI · Breadcrumbs on iOS")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .padding(.vertical, 6)
                .frame(maxWidth: .infinity)
                .background(.ultraThinMaterial)
        }
        .ignoresSafeArea(edges: .bottom)
    }
}
