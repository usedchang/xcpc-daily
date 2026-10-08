#include<bits/stdc++.h>
using namespace std;
// #define endl '\n'
typedef long long ll;
void solve(){
    int n;cin>>n;
    vector<int>p(n*n+2);
    set<ll>st;
    int las=0;
    vector<ll>ans;
    vector<ll>del;
    auto ask=[&]() ->bool {
        del.clear();
        cout<<"? "<<st.size()<<' ';
        for(int v:st) cout<<v<<' ';
        cout<<endl;
        int k;cin>>k;
        if(k==-1) exit(0);
        if(k>=n+1){
            while(k-->0){
                int idx;cin>>idx;
                if(idx==-1) exit(0);
                ans.emplace_back(idx);
            }
            return true;
        }
        bool f=false;
        while(k--){
            int idx;cin>>idx;
            if(idx==-1) exit(0);
            st.erase(idx);
            del.emplace_back(idx);
        }
        for(int v:st){
            auto it=lower_bound(del.begin(),del.end(),v);
            if(it==del.begin()) {
                p[v]=las;
                continue;
            }
            else {
                --it;
                p[v]=*it;
            }
            las=v;
        }
        return false;
    };
    for(int i=1;i<=n*n+1;i++) st.emplace(i);  
    for(int i=1;i<=n;i++){
        if(ask()){
            cout<<"! ";
            int cnt=0;
            for(int v:ans){
                cnt++;
                cout<<v<<' ';
                if(cnt==n+1){
                    break;
                }
            }
            cout<<endl;
            return;
        }
    }
    cout<<"! ";
    while(las){
        ans.push_back(las);
        las=p[las];
    }
    reverse(ans.begin(),ans.end());
    for(int v:ans) {
        cout<<v<<' ';
    }
    cout<<endl;
}
int main(){
    cin.tie(0)->ios::sync_with_stdio(false);
    int T;cin>>T;
    while(T--) solve();
    return 0;
}