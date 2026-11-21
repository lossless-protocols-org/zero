# Generates ios/ZeroBilling/ZeroBillingHost.xcodeproj: a minimal host app and the unit tests of
# the App Store code (3.0, docs/NATIVE.md). The project is committed; run this again only when a
# Swift file is added to or removed from ios/ZeroBilling or its Tests folder.
#
# StoreKit Test needs a real app around the tests (in a bare test bundle the test store offers no
# products), and the zero app itself would mean building React Native for a Swift unit test. The
# host compiles the same billing sources the app does, at the app's deployment target, with Swift's
# complete concurrency checking on.
#
#   G=$(ls -d vendor/bundle/ruby/*)        # the gems CocoaPods was installed with
#   GEM_HOME=$PWD/$G GEM_PATH=$PWD/$G ruby scripts/billing-host-project.rb
require 'xcodeproj'

ROOT = File.expand_path('../ios/ZeroBilling', __dir__)
Dir.chdir(ROOT)
PROJECT = 'ZeroBillingHost.xcodeproj'
APP_DEPLOYMENT_TARGET = '15.1' # the zero app's floor: an API newer than this must sit behind #available
TEST_DEPLOYMENT_TARGET = '17.0' # the tests use StoreKit Test calls from iOS 17

project = Xcodeproj::Project.new(PROJECT)
shared = Dir['*.swift'].sort
tests = Dir['Tests/*.swift'].sort.map { |f| File.basename(f) }

host = project.new_target(:application, 'ZeroBillingHost', :ios, APP_DEPLOYMENT_TARGET)
sources = project.main_group.new_group('Billing', '.')
shared.each { |file| host.source_build_phase.add_file_reference(sources.new_reference(file)) }
host.source_build_phase.add_file_reference(project.main_group.new_group('Host', 'Host').new_reference('HostApp.swift'))

bundle = project.new_target(:unit_test_bundle, 'ZeroBillingTests', :ios, TEST_DEPLOYMENT_TARGET)
test_group = project.main_group.new_group('Tests', 'Tests')
tests.each { |file| bundle.source_build_phase.add_file_reference(test_group.new_reference(file)) }
bundle.add_dependency(host)

[host, bundle].each do |target|
  target.build_configurations.each do |config|
    s = config.build_settings
    s['GENERATE_INFOPLIST_FILE'] = 'YES'
    s['SWIFT_VERSION'] = '5.0'
    s['TARGETED_DEVICE_FAMILY'] = '1,2'
    # Simulator only, signed to run locally: no team, no profile, nothing to keep secret.
    s['CODE_SIGN_STYLE'] = 'Automatic'
    s['CODE_SIGN_IDENTITY'] = '-'
    s['DEVELOPMENT_TEAM'] = ''
    if target == host
      s['PRODUCT_BUNDLE_IDENTIFIER'] = 'dev.lossless.zero.billinghost'
      s['INFOPLIST_KEY_UILaunchScreen_Generation'] = 'YES'
      s['SWIFT_STRICT_CONCURRENCY'] = 'complete'
    else
      s['PRODUCT_BUNDLE_IDENTIFIER'] = 'dev.lossless.zero.billinghost.tests'
      s['TEST_HOST'] = '$(BUILT_PRODUCTS_DIR)/ZeroBillingHost.app/ZeroBillingHost'
      s['BUNDLE_LOADER'] = '$(TEST_HOST)'
    end
  end
end
project.save

scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(host)
scheme.add_test_target(bundle)
scheme.save_as(PROJECT, 'ZeroBillingTests', true)
puts "#{PROJECT}: #{shared.size} billing sources, #{tests.size} test files"
